// This file exports a function to fetch enum values from the server
// The enums are extracted from the database schema on the server side

export async function getEnumValues() {
  const response = await fetch('/api/enums');
  if (!response.ok) {
    throw new Error('Failed to fetch enum values');
  }
  return response.json();
}

// Type definitions (you can also generate these from the API response)
export type Priority = 'High' | 'Medium' | 'Low';
export type Status = 'Planning' | 'In Progress' | 'Completed' | 'On Hold' | 'Cancelled';
