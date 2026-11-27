import express, { Router } from 'express';
import {
  createWorkflowController, deleteWorkflowController, getWorkflowController,
  handleWorkflowError, listWorkflowsController, runWorkflowController, updateWorkflowController,
} from '../controllers/workflow.controller';
import { requireAuth } from '../middleware/require-auth';

const workflowJson = express.json({ limit: '100kb' });
const runJson = express.json({ limit: '16kb', inflate: false });
export const workflowRouter = Router();

workflowRouter.use(requireAuth);
workflowRouter.post('/', workflowJson, createWorkflowController);
workflowRouter.get('/', listWorkflowsController);
workflowRouter.get('/:id', getWorkflowController);
workflowRouter.post('/:id/run', runJson, runWorkflowController);
workflowRouter.patch('/:id', workflowJson, updateWorkflowController);
workflowRouter.delete('/:id', deleteWorkflowController);
workflowRouter.use(handleWorkflowError);
