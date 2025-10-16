# Quick Start - Backend Database

## TL;DR - Setup in 30 seconds

```bash
cd backend-mcp-client
./prismaStartup/init-db.sh  # macOS/Linux
# OR
prismaStartup\init-db.bat   # Windows
```

Done! ✅

## What Just Happened?

- Created SQLite database at `prisma/dev.db`
- Set up 4 tables for Graph Mode
- Generated TypeScript types
- Ready to use!

## Start the Server

```bash
npm run server:dev
```

## Common Commands

| Task | Command |
|------|---------|
| Start server | `npm run server:dev` |
| View database | `npm run db:studio` |
| Reset database | `rm prisma/dev.db && npm run db:push` |
| Update schema | `npm run db:push` |

## Need More Help?

- **Setup Issues**: See [`DATABASE_SETUP.md`](./DATABASE_SETUP.md)
- **Schema Details**: See [`README.md`](./README.md)
- **Existing Setup Guide**: See [`setup-db.md`](./setup-db.md)

## File Structure

```
backend-mcp-client/
├── prisma/
│   ├── schema.prisma          # Database schema definition
│   └── dev.db                 # SQLite database (created by script)
├── prismaStartup/
│   ├── init-db.sh            # Setup script (macOS/Linux)
│   ├── init-db.bat           # Setup script (Windows)
│   ├── README.md             # Detailed documentation
│   ├── DATABASE_SETUP.md     # Setup guide
│   └── QUICK_START.md        # This file
└── .env                      # Environment config (created by script)
```

That's it! 🎉

