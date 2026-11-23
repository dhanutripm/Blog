const express = require('express');
const {
  validateCreate,
  validateUpdate,
  validateListQuery,
  validateIdParam,
} = require('../middleware/validate');

/**
 * Route table for /posts.
 * NOTE: fixed paths (/trash, /stats) are declared BEFORE /:id so Express
 * does not mistake the word "trash" for a post id.
 */
function createPostRoutes(controller, { guard = (req, res, next) => next() } = {}) {
  const router = express.Router();

  router.get('/trash', controller.listTrash);
  router.get('/stats', controller.getStats);

  router
    .route('/')
    .get(validateListQuery, controller.getAllPosts)
    .post(guard, validateCreate, controller.createPost);

  router
    .route('/:id')
    .all(validateIdParam)
    .get(controller.getPost)
    .put(guard, validateUpdate, controller.updatePost)
    .patch(guard, validateUpdate, controller.updatePost)
    .delete(guard, controller.deletePost);

  router.post('/:id/restore', validateIdParam, guard, controller.restorePost);
  router.post('/:id/like', validateIdParam, controller.likePost);

  return router;
}

module.exports = createPostRoutes;
