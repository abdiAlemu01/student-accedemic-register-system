const router = require('express').Router();
const { body } = require('express-validator');

const { login, getMe, register } = require('../controllers/authController');
const authenticate                = require('../middleware/authenticate');
const validate                    = require('../middleware/validate');

router.post('/login', [
  body('email').isEmail().withMessage('Valid email required'),
  body('password').notEmpty().withMessage('Password required'),
  validate,
], login);

router.post('/register', [
  body('email').isEmail().withMessage('Valid email required'),
  body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
  body('role').isIn(['student', 'teacher', 'admin']).withMessage('Role must be student, teacher, or admin'),
  body('name')
    .if(body('role').isIn(['student', 'teacher']))
    .notEmpty().withMessage('Full name is required'),
  body('grade')
    .if(body('role').equals('student'))
    .notEmpty().withMessage('Grade is required'),
  body('section')
    .if(body('role').equals('student'))
    .notEmpty().withMessage('Section is required'),
  validate,
], register);

router.get('/me', authenticate, getMe);

module.exports = router;
