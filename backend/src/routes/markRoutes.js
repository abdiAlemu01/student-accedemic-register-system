
const router        = require('express').Router();
const { body }      = require('express-validator');
const ctrl          = require('../controllers/markController');
const authenticate  = require('../middleware/authenticate');
const authorize     = require('../middleware/authorize');
const validate      = require('../middleware/validate');

// All mark routes require authentication
router.use(authenticate);

router.get('/',                   authorize(['admin','teacher','student']), ctrl.getAllMarks);
router.get('/student/:studentId', authorize(['admin','teacher','student']), ctrl.getMarksByStudent);

// Homeroom teacher: get all submitted marks for their class (for review)
router.get('/class/:classId/submitted', authorize(['teacher']), ctrl.getSubmittedMarksForClass);

// Homeroom teacher: compile (approve) all submitted marks for their class
router.post('/class/:classId/compile', authorize(['teacher']), ctrl.compileMarksForClass);

router.post('/', authorize(['admin','teacher']), [
  body('student_id').isInt(),
  body('subject_id').isInt(),
  body('semester').optional().isIn(['Semester 1', 'Semester 2']),
  body('assignment').isFloat({ min: 0, max: 30 }),
  body('mid').isFloat({ min: 0, max: 30 }),
  body('final').isFloat({ min: 0, max: 40 }),
  validate,
], ctrl.createMark);

router.post('/bulk', authorize(['admin','teacher']), [
  body('subject_id').isInt(),
  body('semester').optional().isIn(['Semester 1', 'Semester 2']),
  body('marks').isArray({ min: 1 }),
  validate,
], ctrl.bulkCreateMarks);

// Subject teacher submits their marks to the homeroom teacher
router.post('/submit', authorize(['teacher']), ctrl.submitResults);

router.put('/:id',    authorize(['admin','teacher']), ctrl.updateMark);
router.delete('/:id', authorize(['admin']),           ctrl.deleteMark);

module.exports = router;
