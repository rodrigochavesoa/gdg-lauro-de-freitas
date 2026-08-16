const PRIORITY_RANK = { urgent: 0, normal: 1 };

export function mergeCurationQueue(pendingJobs, moderationIds = []) {
  const needsModeration = new Set(moderationIds);
  return [...(pendingJobs ?? [])]
    .map((job) => ({
      ...job,
      needsModeration: needsModeration.has(job.id),
    }))
    .sort((left, right) => {
      const byPriority =
        (PRIORITY_RANK[left.priority] ?? 1) - (PRIORITY_RANK[right.priority] ?? 1);
      if (byPriority !== 0) return byPriority;
      const leftTime = Date.parse(left.created_at ?? "") || 0;
      const rightTime = Date.parse(right.created_at ?? "") || 0;
      return rightTime - leftTime;
    });
}
