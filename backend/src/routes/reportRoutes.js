const router        = require('express').Router();
const ctrl          = require('../controllers/reportController');
const authenticate  = require('../middleware/authenticate');
const authorize     = require('../middleware/authorize');

router.use(authenticate);


router.get('/overview',              authorize(['admin']),                     ctrl.overview);
router.get('/all-students',          authorize(['admin']),                     ctrl.allStudentsSummary);
router.get('/class/:classId',        authorize(['admin','teacher']),           ctrl.classReport);
router.get('/student/:studentId',    authorize(['admin','teacher','student']), ctrl.studentReport);
router.post('/compile/:classId',     authorize(['teacher']),                   ctrl.compileClassResults);

module.exports = router;
