const express = require('express');
const auth = require('../controllers/authController');
const authenticate = require('../middleware/authenticate');
const authorizeRoles = require('../middleware/authorizeRoles');
const { authorizeOwner } = require('../middleware/authorizeRoles');

const router = express.Router();
// Initial admin provisioning is handled only by the local seed script. All
// subsequent account creation is restricted to an authenticated administrator.
router.post('/register', authenticate, authorizeRoles('ADMIN'), auth.register);
router.post('/register/farmer', authenticate, authorizeRoles('ADMIN'), auth.registerFarmer);
router.post('/register/buyer', authenticate, authorizeRoles('ADMIN'), auth.registerBuyer);
router.post('/login', auth.login);
router.get('/me', authenticate, auth.me);
router.patch('/me', authenticate, auth.updateMyProfile);
router.get('/users/:userId', authenticate, authorizeOwner('userId'), auth.getAccountById);
router.post('/logout', authenticate, auth.logout);
router.put('/change-password', authenticate, auth.changePassword);

module.exports = router;
