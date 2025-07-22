import { writable, derived } from 'svelte/store';

// Base stores
export const architectData = writable([]);
export const projectData = writable([]);

// Derived stores for common computations
export const totalTasks = derived(architectData, ($architectData) =>
  $architectData.reduce((total, architect) => total + architect.tasks.length, 0)
);

export const tasksByStatus = derived(architectData, ($architectData) => {
  const statusCounts = {};
  $architectData.forEach((architect) => {
    architect.tasks.forEach((task) => {
      statusCounts[task.taskStatus] = (statusCounts[task.taskStatus] || 0) + 1;
    });
  });
  return statusCounts;
});

export const highPriorityTasks = derived(architectData, ($architectData) =>
  $architectData.flatMap((architect) =>
    architect.tasks.filter((task) => task.taskPriority === 'High')
  )
);

// Helper functions
export const getArchitectById = derived(
  architectData,
  ($architectData) => (id) => $architectData.find((arch) => arch.architectId === id)
);

export const getProjectById = derived(
  projectData,
  ($projectData) => (id) => $projectData.find((project) => project.projectId === id)
);
