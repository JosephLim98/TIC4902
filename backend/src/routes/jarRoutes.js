import express from 'express';
import multer from 'multer';
import authMiddleware from '../middleware/auth.js';
import * as jarController from '../controller/jarController.js';

const router = express.Router();

// JAR upload/delete affect what can be deployed and consume storage, so these require an authenticated user (uploadJar also relies on req.user to record who uploaded a given JAR)
router.use(authMiddleware);

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
router.delete('/:id', jarController.deleteJar);

export default router;
