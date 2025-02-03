import express from 'express';
import storageRouter from '../storage/ServerStorageService';

const router = express.Router();

// Mount storage routes under /api/storage
router.use('/storage', storageRouter);

export default router; 