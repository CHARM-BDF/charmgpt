# Database Setup Guide

This guide will help you initialize the Prisma database for the Charm MCP backend.

## Quick Start (Recommended)

### For macOS/Linux:
```bash
cd backend-mcp-client
./prismaStartup/init-db.sh
```

### For Windows:
```cmd
cd backend-mcp-client
prismaStartup\init-db.bat
```

That's it! The script will handle everything automatically.

## What the Script Does

The initialization script performs these steps:

1. **Environment Setup**
   - Creates `.env` file if missing
   - Configures `DATABASE_URL` for SQLite database

2. **Dependency Check**
   - Installs npm packages if `node_modules` is missing
   - Ensures all required dependencies are available

3. **Database Creation**
   - Generates Prisma Client (TypeScript types for database)
   - Creates empty SQLite database at `prisma/dev.db`
   - Applies schema (creates tables: GraphProject, GraphNode, GraphEdge, GraphState)

4. **Verification**
   - Confirms database file was created
   - Reports database size

## Manual Setup

If you prefer to run commands manually:

```bash
# 1. Navigate to backend directory
cd backend-mcp-client

# 2. Install dependencies
npm install

# 3. Create .env file
echo 'DATABASE_URL="file:./prisma/dev.db"' > .env

# 4. Generate Prisma Client
npm run db:generate

# 5. Create database
npm run db:push
```

## Verify Setup

After initialization, verify the database exists:

```bash
ls -lh prisma/dev.db
```

You should see a file around 20-28KB in size.

## Start the Server

Once the database is initialized:

```bash
# Development mode (with hot reload)
npm run server:dev

# Production mode
npm run server
```

The backend will automatically connect to the database.

## View Database Contents

Open Prisma Studio to browse the database:

```bash
npm run db:studio
```

This opens a web interface at `http://localhost:5555` where you can:
- View all tables
- Browse records
- Manually add/edit data
- Test relationships

## Database Schema

The database includes four tables:

- **graph_projects** - Main containers for knowledge graphs
- **graph_nodes** - Individual nodes with positions and metadata
- **graph_edges** - Connections between nodes
- **graph_states** - Snapshots for undo/redo functionality

For detailed schema documentation, see [`prisma/README.md`](./prisma/README.md).

## Troubleshooting

### Script permission denied (macOS/Linux)
```bash
chmod +x prisma/init-db.sh
```

### "Environment variable not found: DATABASE_URL"
Create `.env` file with:
```
DATABASE_URL="file:./prisma/dev.db"
```

### "Cannot find module '@prisma/client'"
```bash
npm run db:generate
```

### Database schema out of sync
```bash
npm run db:push
```

### Reset database (start fresh)
```bash
rm prisma/dev.db
npm run db:push
```

## Next Steps

After database setup:

1. ✅ Database is ready
2. Start backend server: `npm run server:dev`
3. Start frontend (in separate terminal): `cd ../frontend-client && npm run dev`
4. Use Graph Mode in the frontend - data will automatically save to the database

## Additional Resources

- **Detailed Documentation**: [`prismaStartup/README.md`](./README.md)
- **Schema File**: [`prisma/schema.prisma`](../prisma/schema.prisma)
- **Prisma Docs**: https://www.prisma.io/docs

---

**Need Help?** Check the detailed README in the `prismaStartup/` directory or refer to the troubleshooting section above.

