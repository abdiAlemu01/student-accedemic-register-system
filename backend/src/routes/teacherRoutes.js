const router        = require('express').Router();
const { body }      = require('express-validator');
const ctrl          = require('../controllers/teacherController');
const authenticate  = require('../middleware/authenticate');
const authorize     = require('../middleware/authorize');
const validate      = require('../middleware/validate');

router.use(authenticate);

router.get('/',                authorize(['admin', 'teacher', 'student']), ctrl.getAllTeachers);
router.get('/me/assignments',  authorize(['teacher']),                     ctrl.getMyAssignments);
router.get('/:id',             authorize(['admin', 'teacher']),            ctrl.getTeacherById);

router.post('/', authorize(['admin']), [
  body('email').isEmail(),
  body('password').isLength({ min: 6 }),
  body('name').notEmpty(),
  body('subject_id').isInt(),
  body('is_homeroom').optional().isBoolean(),
  body('homeroom_grade').optional().isString(),
  body('homeroom_section').optional().isString(),
  validate,
], ctrl.createTeacher);

router.put('/:id', authorize(['admin']), [
  body('name').notEmpty(),
  body('email').optional().isEmail(),
  body('subject_id').optional().isInt(),
  body('is_homeroom').optional().isBoolean(),
  body('homeroom_grade').optional().isString(),
  body('homeroom_section').optional().isString(),
  validate,
], ctrl.updateTeacher);

router.delete('/:id', authorize(['admin']), ctrl.deleteTeacher);

module.exports = router;
