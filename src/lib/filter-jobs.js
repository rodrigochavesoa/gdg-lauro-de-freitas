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
