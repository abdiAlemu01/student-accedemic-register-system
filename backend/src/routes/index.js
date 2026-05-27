const router = require('express').Router();

router.use('/auth',     require('./authRoutes'));
router.use('/students', require('./studentRoutes'));
router.use('/teachers', require('./teacherRoutes'));
router.use('/subjects', require('./subjectRoutes'));
router.use('/classes',  require('./classRoutes'));
router.use('/marks',    require('./markRoutes'));
router.use('/reports',  require('./reportRoutes'));

module.exports = router;
