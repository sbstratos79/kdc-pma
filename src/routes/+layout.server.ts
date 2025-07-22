import { selectPTS } from '$lib/server/db/queries/selectPTS';

export const load = async () => {
  const ptsData = await selectPTS();

  // Build architect data
  const tempArchitectData = {};
  ptsData.forEach((item) => {
    const architectId = item['architectId'];
    if (!tempArchitectData[architectId]) {
      tempArchitectData[architectId] = {
        architectId: architectId,
        firstName: item['firstName'],
        lastName: item['lastName'],
        tasks: []
      };
    }

    const taskIndex = tempArchitectData[architectId]['tasks'].findIndex(
      (task) => task['taskId'] === item['taskId']
    );
    if (taskIndex === -1) {
      tempArchitectData[architectId]['tasks'].push({
        taskId: item['taskId'],
        taskName: item['taskName'],
        taskDescription: item['taskDescription'],
        taskStartDate: item['taskStartDate'],
        taskDueDate: item['taskDueDate'],
        taskStatus: item['taskStatus'],
        taskPriority: item['taskPriority'],
        projectName: item['projectName'],
        subtasks: []
      });
    }

    const task = tempArchitectData[architectId]['tasks'].find(
      (task) => task['taskId'] === item['taskId']
    );
    if (item['subtaskId']) {
      task['subtasks'].push({
        subtaskId: item['subtaskId'],
        subtaskName: item['subtaskName'],
        subtaskDescription: item['subtaskDescription'],
        subtaskStatus: item['subtaskStatus']
      });
    }
  });

  // Build project data
  const tempProjectData = {};
  ptsData.forEach((item) => {
    const projectId = item['projectId'];
    if (!tempProjectData[projectId]) {
      tempProjectData[projectId] = {
        projectId: projectId,
        projectName: item['projectName'],
        projectDescription: item['projectDescription'],
        projectStartDate: item['projectStartDate'],
        projectDueDate: item['projectDueDate'],
        projectStatus: item['projectStatus'],
        projectPriority: item['projectPriority'],
        tasks: []
      };
    }

    const taskIndex = tempProjectData[projectId]['tasks'].findIndex(
      (task) => task['taskId'] === item['taskId']
    );
    if (taskIndex === -1) {
      tempProjectData[projectId]['tasks'].push({
        taskId: item['taskId'],
        taskName: item['taskName'],
        taskDescription: item['taskDescription'],
        taskStartDate: item['taskStartDate'],
        taskDueDate: item['taskDueDate'],
        taskStatus: item['taskStatus'],
        taskPriority: item['taskPriority'],
        projectName: item['projectName'],
        subtasks: []
      });
    }

    const task = tempProjectData[projectId]['tasks'].find(
      (task) => task['taskId'] === item['taskId']
    );
    if (item['subtaskId']) {
      task['subtasks'].push({
        subtaskId: item['subtaskId'],
        subtaskName: item['subtaskName'],
        subtaskDescription: item['subtaskDescription'],
        subtaskStatus: item['subtaskStatus']
      });
    }
  });

  // Sort tasks by priority and due date
  const priorityOrder = { High: 1, Medium: 2, Low: 3 };
  Object.values(tempArchitectData).forEach((architect) => {
    architect.tasks.sort((a, b) => {
      const priorityDiff = priorityOrder[a.taskPriority] - priorityOrder[b.taskPriority];
      if (priorityDiff !== 0) return priorityDiff;
      return new Date(a.taskDueDate) - new Date(b.taskDueDate);
    });
  });

  Object.values(tempProjectData).forEach((project) => {
    project.tasks.sort((a, b) => {
      const priorityDiff = priorityOrder[a.taskPriority] - priorityOrder[b.taskPriority];
      if (priorityDiff !== 0) return priorityDiff;
      return new Date(a.taskDueDate) - new Date(b.taskDueDate);
    });
  });

  return {
    architectData: Object.values(tempArchitectData),
    projectData: Object.values(tempProjectData)
  };
};
