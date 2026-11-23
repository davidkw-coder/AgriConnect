const express = require('express');
const authenticate = require('../middleware/authenticate');
const authorizeRoles = require('../middleware/authorizeRoles');
const uploadImage = require('../middleware/uploadImage');
const farmer = require('../controllers/farmerController');

const router = express.Router();
router.use(authenticate, authorizeRoles('FARMER'));

router.get('/dashboard', farmer.dashboard);
router.post('/profile', farmer.createProfile);
router.get('/profile', farmer.getProfile);
router.patch('/profile', farmer.updateProfile);
router.put('/profile/picture', uploadImage, farmer.updateProfilePicture);

router.get('/categories', farmer.categories);
router.get('/products', farmer.listProducts);
router.post('/products', uploadImage, farmer.createProduct);
router.post('/products/bulk', farmer.createProducts);
router.get('/products/:productId', farmer.getProduct);
router.put('/products/:productId', uploadImage, farmer.updateProduct);
router.patch('/products/:productId/stock', farmer.updateStock);
router.delete('/products/:productId', farmer.archiveProduct);

router.get('/inquiries', farmer.listInquiries);
router.get('/inquiries/:inquiryId', farmer.getInquiry);
router.post('/inquiries/:inquiryId/responses', farmer.respondToInquiry);

module.exports = router;
