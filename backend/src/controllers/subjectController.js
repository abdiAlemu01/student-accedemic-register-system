const db = require('../config/db');

const getAllSubjects = async (_req, res) => {
  try {
    const { rows } = await db.query('SELECT * FROM subjects ORDER BY name');
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

const getSubjectById = async (req, res) => {
  try {
    const { rows } = await db.query('SELECT * FROM subjects WHERE id=$1', [req.params.id]);
    if (!rows.length) return res.status(404).json({ error: 'Subject not found' });
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

const createSubject = async (req, res) => {
  try {
    const { name, department = null, total_mark = 100, pass_mark = 50 } = req.body;
    if (Number(pass_mark) > Number(total_mark)) {
      return res.status(400).json({ error: 'Pass mark cannot be greater than total mark' });
    }
    const { rows: [subject] } = await db.query(
      'INSERT INTO subjects (name, department, total_mark, pass_mark) VALUES ($1,$2,$3,$4) RETURNING *',
      [name, department || null, total_mark, pass_mark]
    );
    res.status(201).json(subject);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

const updateSubject = async (req, res) => {
  try {
    const { name, department = null, total_mark, pass_mark } = req.body;
    if (total_mark === undefined || pass_mark === undefined) {
      return res.status(400).json({ error: 'Total mark and pass mark are required' });
    }
    if (Number(pass_mark) > Number(total_mark)) {
      return res.status(400).json({ error: 'Pass mark cannot be greater than total mark' });
    }
    const { rows } = await db.query(
      'UPDATE subjects SET name=$1, department=$2, total_mark=$3, pass_mark=$4 WHERE id=$5 RETURNING *',
      [name, department || null, total_mark, pass_mark, req.params.id]
    );
    if (!rows.length) return res.status(404).json({ error: 'Subject not found' });
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

const deleteSubject = async (req, res) => {
  try {
    const { rows } = await db.query('DELETE FROM subjects WHERE id=$1 RETURNING id', [req.params.id]);
    if (!rows.length) return res.status(404).json({ error: 'Subject not found' });
    res.json({ message: 'Subject deleted' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

module.exports = { getAllSubjects, getSubjectById, createSubject, updateSubject, deleteSubject };
