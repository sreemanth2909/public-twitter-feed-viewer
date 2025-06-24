const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
// app.use(helmet());
// app.use(cors({
//   origin: (origin, callback) => callback(null, true),
//   credentials: true
// }));
app.use((req, res, next) => {
  res.header("Access-Control-Allow-Origin", "*"); // Allow all origins for dev
  res.header("Access-Control-Allow-Methods", "GET,PUT,POST,DELETE,OPTIONS");
  res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept, Authorization");
  res.header("Access-Control-Allow-Credentials", "true");
  if (req.method === "OPTIONS") {
    return res.sendStatus(200);
  }
  next();
});

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100 // limit each IP to 100 requests per windowMs
});
app.use(limiter);

app.use(express.json({ limit: '10mb' }));

// MongoDB Connection
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/x-feed-viewer', {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});

const db = mongoose.connection;
db.on('error', console.error.bind(console, 'MongoDB connection error:'));
db.once('open', () => {
  console.log('Connected to MongoDB');
});

// Token Schema
const tokenSchema = new mongoose.Schema({
  userId: { type: String, required: true },
  name: { type: String, required: true },
  data: {
    csrfToken: { type: String, required: true },
    authToken: { type: String, required: true }
  },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

const Token = mongoose.model('Token', tokenSchema);

// User Schema (for future authentication)
const userSchema = new mongoose.Schema({
  deviceId: { type: String, required: true, unique: true },
  createdAt: { type: Date, default: Date.now }
});

const User = mongoose.model('User', userSchema);

// Routes

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

// Get or create user by device ID
app.post('/api/users', async (req, res) => {
  try {
    const { deviceId } = req.body;
    
    if (!deviceId) {
      return res.status(400).json({ error: 'Device ID is required' });
    }

    let user = await User.findOne({ deviceId });
    
    if (!user) {
      user = new User({ deviceId });
      await user.save();
    }

    res.json({ userId: user._id.toString() });
  } catch (error) {
    console.error('Error creating/finding user:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get all tokens for a user
app.get('/api/tokens/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    
    const tokens = await Token.find({ userId }).sort({ createdAt: -1 });
    
    res.json({ tokens: tokens.map(token => ({
      id: token._id.toString(),
      name: token.name,
      data: token.data,
      createdAt: token.createdAt
    }))});
  } catch (error) {
    console.error('Error fetching tokens:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Add a new token
app.post('/api/tokens', async (req, res) => {
  try {
    const { userId, name, data } = req.body;
    
    if (!userId || !name || !data) {
      return res.status(400).json({ error: 'userId, name, and data are required' });
    }

    if (!data.csrfToken || !data.authToken) {
      return res.status(400).json({ error: 'Token data is incomplete' });
    }

    const token = new Token({
      userId,
      name,
      data: {
        csrfToken: data.csrfToken,
        authToken: data.authToken
      }
    });

    await token.save();
    
    res.json({
      id: token._id.toString(),
      name: token.name,
      data: token.data,
      createdAt: token.createdAt
    });
  } catch (error) {
    console.error('Error adding token:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Update a token
app.put('/api/tokens/:tokenId', async (req, res) => {
  try {
    const { tokenId } = req.params;
    const { name, data } = req.body;
    
    const token = await Token.findById(tokenId);
    
    if (!token) {
      return res.status(404).json({ error: 'Token not found' });
    }

    if (name) token.name = name;
    if (data) {
      token.data = {
        authorization: data.authorization || token.data.authorization,
        csrfToken: data.csrfToken || token.data.csrfToken,
        authToken: data.authToken || token.data.authToken
      };
    }
    
    token.updatedAt = new Date();
    await token.save();
    
    res.json({
      id: token._id.toString(),
      name: token.name,
      data: token.data,
      createdAt: token.createdAt,
      updatedAt: token.updatedAt
    });
  } catch (error) {
    console.error('Error updating token:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Delete a token
app.delete('/api/tokens/:tokenId', async (req, res) => {
  try {
    const { tokenId } = req.params;
    
    const token = await Token.findByIdAndDelete(tokenId);
    
    if (!token) {
      return res.status(404).json({ error: 'Token not found' });
    }
    
    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting token:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get all users (for user list in extension)
app.get('/api/users', async (req, res) => {
  try {
    const users = await User.find({});
    res.json({
      users: users.map(user => ({
        userId: user._id.toString(),
        deviceId: user.deviceId,
        createdAt: user.createdAt
      }))
    });
  } catch (error) {
    console.error('Error fetching users:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Something went wrong!' });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
}); 