import express, { Router } from 'express';
import {
  createWorkflowController, deleteWorkflowController, getWorkflowController,
  handleWorkflowError, listWorkflowsController, updateWorkflowController,
} from '../controllers/workflow.controller';
import { requireAuth } from '../middleware/require-auth';

const workflowJson = express.json({ limit: '100kb' });
export const workflowRouter = Router();

workflowRouter.use(requireAuth);
workflowRouter.post('/', workflowJson, createWorkflowController);
workflowRouter.get('/', listWorkflowsController);
workflowRouter.get('/:id', getWorkflowController);
workflowRouter.patch('/:id', workflowJson, updateWorkflowController);
workflowRouter.delete('/:id', deleteWorkflowController);
workflowRouter.use(handleWorkflowError);
