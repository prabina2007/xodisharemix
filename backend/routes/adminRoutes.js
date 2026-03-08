const express = require('express');
const authMiddleware = require('../middleware/authMiddleware');
const adminMiddleware = require('../middleware/adminMiddleware');
const {
  adminLogin,
  listUsers,
  deleteUser,
  listSongs,
  deleteSong,
} = require('../controllers/adminController');

const router = express.Router();

router.post('/login', adminLogin);
router.get('/users', authMiddleware, adminMiddleware, listUsers);
router.delete('/users/:id', authMiddleware, adminMiddleware, deleteUser);
router.get('/songs', authMiddleware, adminMiddleware, listSongs);
router.delete('/songs/:id', authMiddleware, adminMiddleware, deleteSong);

module.exports = router;