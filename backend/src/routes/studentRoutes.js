const router        = require('express').Router();
const { body }      = require('express-validator');
const ctrl          = require('../controllers/studentController');
const authenticate  = require('../middleware/authenticate');
const authorize     = require('../middleware/authorize');
const validate      = require('../middleware/validate');

router.use(authenticate);

router.get('/',    authorize(['admin', 'teacher', 'student']), ctrl.getAllStudents);
router.get('/:id', authorize(['admin', 'teacher', 'student']), ctrl.getStudentById);

router.post('/', authorize(['admin']), [
  body('email').isEmail(),
  body('password').isLength({ min: 6 }),
  body('name').notEmpty(),
  body('grade').notEmpty(),
  body('section').notEmpty(),
  body('academic_year').notEmpty(),
  body('semester').notEmpty(),
  validate,
], ctrl.createStudent);

router.put('/:id', authorize(['admin']), [
  body('name').notEmpty(),
  validate,
], ctrl.updateStudent);

router.delete('/:id', authorize(['admin']), ctrl.deleteStudent);

module.exports = router;
