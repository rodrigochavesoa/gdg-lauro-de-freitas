export function filterJobs(jobs, { query = "", tech = [], level = [] } = {}) {
  const normalizedQuery = query.toLowerCase();

  return jobs.filter((job) => {
    const searched = `${job.title} ${job.company} ${job.stack.join(" ")}`
      .toLowerCase()
      .includes(normalizedQuery);
    const hasTech =
      tech.length === 0 ||
      tech.some((item) => job.stack.join(" ").toLowerCase().includes(item.toLowerCase()));
    const hasLevel = level.length === 0 || level.includes(job.level);

    return searched && hasTech && hasLevel;
  });
}

export function toggleFilterValue(item, values) {
  return values.includes(item) ? values.filter((value) => value !== item) : [...values, item];
}

export const SORT_RECENT = "recent";
export const SORT_OLDEST = "oldest";

function postedTime(job) {
  const parsed = Date.parse(job?.postedAt ?? "");
  return Number.isNaN(parsed) ? 0 : parsed;
}

export function sortJobs(jobs, order = SORT_RECENT) {
  const ranked = [...jobs];
  ranked.sort((left, right) => {
    const delta = postedTime(right) - postedTime(left);
    return order === SORT_OLDEST ? -delta : delta;
  });
  return ranked;
}
