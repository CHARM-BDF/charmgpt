# Charm MCP Database Setup

This directory contains the Prisma database schema and initialization scripts for the Charm MCP backend, which powers the Graph Mode knowledge graph feature.

## Quick Start

For new users pulling this repository, simply run:

```bash
./prismaStartup/init-db.sh
```

This automated script will:
- ✅ Create `.env` file if missing
- ✅ Configure `DATABASE_URL` environment variable
- ✅ Install dependencies if needed
- ✅ Generate Prisma Client
- ✅ Create an empty SQLite database with proper schema
- ✅ Verify database creation

## Database Schema

The database uses SQLite and includes four main tables:

### 1. **GraphProject** (`graph_projects`)
Main container for knowledge graphs, linked to frontend conversations.

| Field | Type | Description |
|-------|------|-------------|
| id | String (CUID) | Unique identifier |
| name | String | Project name |
| description | String? | Optional description |
| conversationId | String (Unique) | Links to frontend conversation |
| conversationName | String | Cached conversation name |
| createdAt | DateTime | Creation timestamp |
| updatedAt | DateTime | Last update timestamp |

**Relationships:**
- Has many `GraphNode` (cascade delete)
- Has many `GraphEdge` (cascade delete)
- Has many `GraphState` (cascade delete)

### 2. **GraphNode** (`graph_nodes`)
Individual nodes in the knowledge graph.

| Field | Type | Description |
|-------|------|-------------|
| id | String | Node identifier (CURIEs, e.g., `NCBIGene:123`) |
| graphId | String | Foreign key to GraphProject |
| label | String | Display name |
| type | String | Node type (e.g., `gene`, `drug`, `disease`) |
| data | String | Flexible metadata (JSON string) |
| position | String | x, y coordinates for layout (JSON string) |
| createdAt | DateTime | Creation timestamp |

**Composite Primary Key:** `[id, graphId]`
- Allows same node ID in different graphs
- Enables sharing CURIEs across projects

### 3. **GraphEdge** (`graph_edges`)
Connections between nodes.

| Field | Type | Description |
|-------|------|-------------|
| id | String (CUID) | Unique edge identifier |
| graphId | String | Foreign key to GraphProject |
| source | String | Source node ID |
| target | String | Target node ID |
| label | String? | Edge label/predicate |
| type | String? | Edge type |
| data | String? | Flexible metadata (JSON string) |
| createdAt | DateTime | Creation timestamp |

**Note:** Foreign key constraints to nodes removed due to composite key complexity. Relationships maintained through application logic.

### 4. **GraphState** (`graph_states`)
Snapshots for undo/redo functionality.

| Field | Type | Description |
|-------|------|-------------|
| id | String (CUID) | Unique identifier |
| graphId | String | Foreign key to GraphProject |
| snapshot | String | Complete graph state (JSON string) |
| command | String | Description of change |
| timestamp | DateTime | When state was saved |

## Manual Setup

If you prefer manual setup or the script doesn't work:

### Prerequisites
```bash
# Install dependencies
cd backend-mcp-client
npm install
```

### Setup Steps

1. **Create `.env` file** (if not exists):
   ```bash
   echo 'DATABASE_URL="file:./prisma/dev.db"' > .env
   ```

2. **Generate Prisma Client**:
   ```bash
   npm run db:generate
   ```

3. **Create database schema**:
   ```bash
   npm run db:push
   ```

4. **Verify database exists**:
   ```bash
   ls -lh prisma/dev.db
   ```

## Available Scripts

From the `backend-mcp-client` directory:

| Script | Command | Description |
|--------|---------|-------------|
| Generate Client | `npm run db:generate` | Generate Prisma Client types |
| Push Schema | `npm run db:push` | Sync schema to database |
| Create Migration | `npm run db:migrate` | Create versioned migration |
| Database Studio | `npm run db:studio` | Open GUI to view/edit data |
| Start Server | `npm run server` | Start backend server |
| Dev Server | `npm run server:dev` | Start with hot reload |

## Database Location

The SQLite database file is located at:
```
backend-mcp-client/prisma/dev.db
```

This is a local file-based database. No external database server required.

## JSON Data Handling

**Important**: The database stores JSON data as `String` fields, not native JSON types. This is because:

1. **SQLite Compatibility**: SQLite doesn't have native JSON support in older versions
2. **Prisma Limitation**: Prisma's `Json` type isn't supported with SQLite in this version
3. **Application Responsibility**: The application code must serialize/deserialize JSON manually

**Example Usage**:
```typescript
// Storing JSON data
const nodeData = { category: "gene", expression: "high" };
await prisma.graphNode.create({
  data: {
    id: "NCBIGene:123",
    label: "STAT4",
    type: "gene",
    data: JSON.stringify(nodeData), // Serialize to string
    position: JSON.stringify({ x: 100, y: 200 }), // Serialize to string
    graphId: "project-123"
  }
});

// Reading JSON data
const node = await prisma.graphNode.findFirst();
const nodeData = JSON.parse(node.data); // Deserialize from string
const position = JSON.parse(node.position); // Deserialize from string
```

## Environment Variables

Required in `backend-mcp-client/.env`:

```env
DATABASE_URL="file:./prisma/dev.db"
```

For production, you can use other database providers supported by Prisma (PostgreSQL, MySQL, etc.) by changing the `datasource` in `schema.prisma`.

## Backup & Restore

### Create Backup
```bash
# Copy database file
cp prisma/dev.db prisma/dev.db.backup

# Or export as SQL
sqlite3 prisma/dev.db .dump > prisma/data_backup.sql
```

### Restore Backup
```bash
# From file backup
cp prisma/dev.db.backup prisma/dev.db

# From SQL backup
rm prisma/dev.db
sqlite3 prisma/dev.db < prisma/data_backup.sql
```

## Troubleshooting

### Issue: "Environment variable not found: DATABASE_URL"
**Solution:** Create or update `.env` file with `DATABASE_URL="file:./prisma/dev.db"`

### Issue: "Cannot find module '@prisma/client'"
**Solution:** Run `npm run db:generate` to generate Prisma Client

### Issue: Database schema out of sync
**Solution:** Run `npm run db:push` to sync schema

### Issue: Permission denied on init-db.sh
**Solution:** Run `chmod +x prisma/init-db.sh`

### Issue: Database locked
**Solution:** 
- Close Prisma Studio if open
- Stop any running backend servers
- Delete `prisma/dev.db-journal` if it exists

## Development Workflow

1. **Modify schema**: Edit `schema.prisma`
2. **Update database**: Run `npm run db:push` (or `npm run db:migrate` for versioned migrations)
3. **Regenerate client**: Run `npm run db:generate` (usually automatic)
4. **Restart server**: Changes take effect on next server start

## Schema Migrations

For production-ready migrations with version control:

```bash
# Create a new migration
npm run db:migrate

# This will:
# 1. Prompt for migration name
# 2. Create SQL migration file in prisma/migrations/
# 3. Apply migration to database
# 4. Regenerate Prisma Client
```

## Prisma Studio

Visual database browser:

```bash
npm run db:studio
```

Opens at `http://localhost:5555` - useful for:
- Viewing data
- Manual data entry
- Debugging relationships
- Testing queries

## Integration with Frontend

The database is automatically used by the backend MCP server when:
- Creating new Graph Mode conversations
- Saving/loading knowledge graphs
- Managing graph state for undo/redo
- Persisting node positions and metadata

No additional configuration needed once database is initialized.

## Additional Resources

- [Prisma Documentation](https://www.prisma.io/docs)
- [Prisma Schema Reference](https://www.prisma.io/docs/reference/api-reference/prisma-schema-reference)
- [SQLite Documentation](https://www.sqlite.org/docs.html)

---

**Last Updated:** January 2025  
**Database Version:** 1.0  
**Prisma Version:** 5.22.0

