# Graph Mode Database Setup

## Prerequisites
1. Install dependencies: `npm install`
2. Set up environment: Create `.env` file with `DATABASE_URL="file:./dev.db"`

## Database Setup Commands
```bash
# Generate Prisma client
npm run db:generate

# Create and push database schema
npm run db:push

# (Optional) Create migration
npm run db:migrate

# (Optional) Open Prisma Studio to view data
npm run db:studio
```

## Database Schema
- **GraphProject**: Main graph container linked to frontend project
- **GraphNode**: Individual nodes with position and data
- **GraphEdge**: Connections between nodes
- **GraphState**: Snapshots for undo/redo functionality

## Next Steps
1. Run the setup commands above
2. Test database connection
3. Create Graph Mode API routes
4. Integrate with MCP system
