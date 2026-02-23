## command for viewing database
cd "/Users/admin1/Documents/web/b2bjewellerary /packages/database" && npx prisma studio

## bakcend 
lsof -ti :3001 | xargs kill -9 2>/dev/null; sleep 2; cd "/Users/admin1/Documents/web/b2bjewellerary /packages/api" && npm run dev