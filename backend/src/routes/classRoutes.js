const router        = require('express').Router();
const { body }      = require('express-validator');
const ctrl          = require('../controllers/classController');
const authenticate  = require('../middleware/authenticate');
const authorize     = require('../middleware/authorize');
const validate      = require('../middleware/validate');

router.use(authenticate);

router.get('/',    authorize(['admin','teacher','student']), ctrl.getAllClasses);

router.post('/', authorize(['admin']), [
  body('grade').notEmpty(),
  body('section').notEmpty(),
  body('academic_year').optional().isString(),
  validate,
], ctrl.createClass);

router.put('/:id', authorize(['admin']), [
  body('grade').notEmpty(),
  body('section').notEmpty(),
  body('academic_year').optional().isString(),
  validate,
], ctrl.updateClass);

router.delete('/:id', authorize(['admin']), ctrl.deleteClass);

// Students in a class
router.get('/:id/students',                        authorize(['admin','teacher']), ctrl.getClassStudents);
router.post('/:id/enroll',                         authorize(['admin']),           ctrl.enrollStudent);
router.delete('/:id/enroll/:studentId',            authorize(['admin']),           ctrl.unenrollStudent);

// Teacher assignments for a class
router.get('/:id/assignments',                     authorize(['admin','teacher']), ctrl.getClassAssignments);
router.post('/:id/assignments',                    authorize(['admin']),           ctrl.assignTeacher);
router.delete('/assignments/:assignmentId',        authorize(['admin']),           ctrl.removeAssignment);

module.exports = router;
