# LaxBay Website

LaxBay is a consumer-to-consumer (C2C) marketplace where users, after registering or logging in, can create "listings" for any lacrosse gear or apparel they want to sell. Other users can browse all listings or use a search engine to find specific items — from cleats to jerseys and everything in between

# Features

User Authentication: Secure registration and login.

Create Listings: Users can create, edit, and delete their gear listings.

Browse Listings: All users can view available gear and apparel.

Search Functionality: Search for specific items across categories (e.g., cleats, jerseys, helmets).

Admin Controls: Admins can manage listings and users (demo login available for testing).

NeonDB Integration: Connected to a live PostgreSQL database using NeonDB.

# Dependencies

### Core

axios
cors
lucide-react
react
react-dom
react-router-dom

### Styling 

tailwindcss

## Setup/Testing

1. Install dependencies

npm install

2. This project is already connected to NeonDB and is included in the .env

3. Start the backend server

4. Visit http://localhost:5173 to view the app

5. For testing admin features use the following demo login

Username: testAdmin
Password: test123