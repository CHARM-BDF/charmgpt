# File Relationships

## Overview
The file management system supports creating and managing relationships between files. This allows tracking dependencies, references, and other connections between files in the system.

## Features

### Creating Relationships
- Create relationships between any two files in the system
- Specify relationship types (e.g., "references", "depends-on", "derived-from")
- Optional relationship metadata and descriptions
- Automatic validation of file existence

### Viewing Relationships
- View all relationships for a file
- See related file details including metadata
- Filter relationships by type
- Relationship information shown in file details view

### Managing Relationships
- Add new relationships through the UI
- Remove existing relationships
- Update relationship types
- Automatic cleanup of relationships when files are deleted

## Storage
Relationships are stored in the `storage/relationships` directory, with one JSON file per source file containing all its relationships. The filename is the source file's ID with a `.json` extension.

Example relationship file (`storage/relationships/file-id-123.json`):
```json
[
  {
    "targetId": "file-id-456",
    "type": "references"
  },
  {
    "targetId": "file-id-789",
    "type": "depends-on"
  }
]
```

## API Endpoints

### Get Relationships
```http
GET /api/storage/files/:id/relationships
```
Returns all relationships for a file, including related file details.

### Add Relationship
```http
POST /api/storage/files/:id/relationships
Content-Type: application/json

{
  "targetId": "target-file-id",
  "type": "relationship-type"
}
```
Creates a new relationship between files.

### Remove Relationship
```http
DELETE /api/storage/files/:sourceId/relationships/:targetId
```
Removes a relationship between files.

## UI Components
The file manager includes UI components for:
- Viewing relationships in the file details modal
- Adding new relationships through a modal dialog
- Removing relationships with a single click
- Displaying relationship types with visual indicators

## Best Practices
1. Use consistent relationship types across the system
2. Validate both source and target files exist before creating relationships
3. Consider the impact of file deletions on relationships
4. Use descriptive relationship types that indicate the nature of the connection
5. Keep relationship metadata minimal and focused
6. Clean up relationships when they are no longer valid

## Future Enhancements
1. Bidirectional relationships
2. Relationship visualization (graph view)
3. Relationship impact analysis
4. Bulk relationship operations
5. Relationship validation rules
6. Advanced relationship querying 