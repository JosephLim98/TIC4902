import express from 'express';
import multer from 'multer';
import * as jarController from '../controller/jarController.js';

const router = express.Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 500 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (file.originalname.endsWith('.jar')) {
      cb(null, true);
    } else {
      cb(new Error('Only .jar files are accepted'));
    }
  },
});

router.post('/', upload.single('file'), jarController.uploadJar);
router.get('/', jarController.listJars);

export default router;
