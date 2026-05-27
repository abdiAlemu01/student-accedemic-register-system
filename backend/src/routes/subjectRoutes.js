const router        = require('express').Router();
const { body }      = require('express-validator');
const ctrl          = require('../controllers/subjectController');
const authenticate  = require('../middleware/authenticate');
const authorize     = require('../middleware/authorize');
const validate      = require('../middleware/validate');

router.use(authenticate);

router.get('/',    authorize(['admin','teacher','student']), ctrl.getAllSubjects);
router.get('/:id', authorize(['admin','teacher','student']), ctrl.getSubjectById);

router.post('/', authorize(['admin']), [
  body('name').notEmpty().withMessage('Name required'),
  body('department').optional().isString(),
  body('total_mark').optional().isInt({ min: 1, max: 100 }),
  body('pass_mark').optional().isInt({ min: 0, max: 100 }),
  validate,
], ctrl.createSubject);

router.put('/:id', authorize(['admin']), [
  body('name').notEmpty(),
  body('department').optional().isString(),
  body('total_mark').isInt({ min: 1, max: 100 }),
  body('pass_mark').isInt({ min: 0, max: 100 }),
  validate,
], ctrl.updateSubject);

router.delete('/:id', authorize(['admin']), ctrl.deleteSubject);

module.exports = router;
