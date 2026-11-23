const AppError = require('../utils/AppError');
const { asyncHandler, sendSuccess } = require('../utils/helpers');

/**
 * Controllers translate HTTP <-> model calls. No storage or validation
 * rules live here – only status codes, messages and 404 handling.
 */
function createPostController(model) {
  const notFound = (ref) => new AppError(`Post '${ref}' not found`, 404);

  return {
    // POST /posts  -> 201
    createPost: asyncHandler(async (req, res) => {
      const post = await model.create(req.validated);
      res.location(`/posts/${post.id}`);
      sendSuccess(res, 201, 'Post created successfully', post);
    }),

    // GET /posts  -> 200 (supports search / filter / sort / pagination)
    getAllPosts: asyncHandler(async (req, res) => {
      const { items, meta } = await model.list(req.listQuery);
      sendSuccess(res, 200, `${meta.total} post(s) found`, items, meta);
    }),

    // GET /posts/:id  -> 200 | 404   (:id may be the UUID or the slug)
    getPost: asyncHandler(async (req, res) => {
      const post = await model.view(req.params.id);
      if (!post) throw notFound(req.params.id);
      sendSuccess(res, 200, 'Post retrieved successfully', post);
    }),

    // PUT|PATCH /posts/:id  -> 200 | 400 | 404
    updatePost: asyncHandler(async (req, res) => {
      const post = await model.update(req.params.id, req.validated);
      if (!post) throw notFound(req.params.id);
      sendSuccess(res, 200, 'Post updated successfully', post);
    }),

    // DELETE /posts/:id            -> moves to trash (soft delete)
    // DELETE /posts/:id?permanent=true -> removes for good
    deletePost: asyncHandler(async (req, res) => {
      const flag = req.query.permanent;
      if (flag !== undefined && flag !== 'true' && flag !== 'false') {
        throw new AppError("Query parameter 'permanent' must be 'true' or 'false'", 400);
      }

      if (flag === 'true') {
        const removed = await model.hardDelete(req.params.id);
        if (!removed) throw notFound(req.params.id);
        return sendSuccess(res, 200, 'Post permanently deleted', removed);
      }

      const post = await model.softDelete(req.params.id);
      if (!post) throw notFound(req.params.id);
      sendSuccess(res, 200, 'Post moved to trash. Restore it with POST /posts/:id/restore', post);
    }),

    // GET /posts/trash
    listTrash: asyncHandler(async (req, res) => {
      const items = await model.listTrash();
      sendSuccess(res, 200, `${items.length} post(s) in trash`, items);
    }),

    // POST /posts/:id/restore  -> 200 | 404 | 409
    restorePost: asyncHandler(async (req, res) => {
      const existing = await model.find(req.params.id, { includeDeleted: true });
      if (!existing) throw notFound(req.params.id);
      if (!existing.deletedAt) throw new AppError('Post is not in the trash', 409);
      const post = await model.restore(req.params.id);
      sendSuccess(res, 200, 'Post restored successfully', post);
    }),

    // POST /posts/:id/like  -> 200 | 404
    likePost: asyncHandler(async (req, res) => {
      const post = await model.like(req.params.id);
      if (!post) throw notFound(req.params.id);
      sendSuccess(res, 200, 'Post liked', { id: post.id, likes: post.likes });
    }),

    // GET /posts/stats
    getStats: asyncHandler(async (req, res) => {
      sendSuccess(res, 200, 'Blog statistics', await model.stats());
    }),
  };
}

module.exports = createPostController;
