# Advanced Task Manager API

A comprehensive RESTful API for task management with user authentication, task collaboration, priorities, tags, categories, deadlines, and reminders.

## Features

✨ **User Authentication & Authorization**
- JWT-based authentication
- Role-based access control (User, Manager, Admin)
- Secure password hashing with bcrypt
- Token refresh mechanism

📋 **Task Management**
- CRUD operations for tasks
- Task status tracking (todo, in-progress, review, completed, cancelled)
- Priority levels (low, medium, high, urgent)
- Categories and tags
- Subtasks support
- Progress tracking
- Comments system
- File attachments support

👥 **Collaboration Features**
- Task assignment to multiple users
- Project-based task organization
- Team member management
- Role-based project permissions

⏰ **Deadlines & Reminders**
- Due date tracking
- Automated reminder notifications
- Overdue task detection
- Email notifications (configurable)

📊 **Analytics**
- Task statistics by status and priority
- Overdue and due-soon task tracking
- Project progress monitoring

🔔 **Notification System**
- Real-time notifications for task updates
- Assignment notifications
- Deadline reminders
- Comment notifications

## Tech Stack

- **Runtime**: Node.js
- **Framework**: Express.js
- **Database**: MongoDB with Mongoose ODM
- **Authentication**: JWT (JSON Web Tokens)
- **Validation**: express-validator
- **Security**: Helmet, CORS, Rate Limiting
- **Scheduling**: node-cron

## Installation

### Prerequisites
- Node.js (v14 or higher)
- MongoDB (v4.4 or higher)
- npm or yarn

### Setup

1. **Clone the repository**
```bash
git clone <repository-url>
cd advanced-task-manager-api
```

2. **Install dependencies**
```bash
npm install
```

3. **Environment Configuration**
```bash
cp .env.example .env
```

Edit `.env` file with your configuration:
```env
PORT=5000
NODE_ENV=development
MONGODB_URI=mongodb://localhost:27017/task-manager
JWT_SECRET=your-super-secret-jwt-key
JWT_EXPIRE=7d
JWT_REFRESH_SECRET=your-refresh-token-secret
JWT_REFRESH_EXPIRE=30d
```

4. **Start the server**
```bash
# Development mode with auto-reload
npm run dev

# Production mode
npm start
```

## API Documentation

### Base URL
```
http://localhost:5000/api
```

### Authentication Endpoints

#### Register User
```http
POST /api/auth/register
Content-Type: application/json

{
  "name": "John Doe",
  "email": "john@example.com",
  "password": "password123"
}
```

**Response:**
```json
{
  "success": true,
  "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": "507f1f77bcf86cd799439011",
    "name": "John Doe",
    "email": "john@example.com",
    "role": "user"
  }
}
```

#### Login
```http
POST /api/auth/login
Content-Type: application/json

{
  "email": "john@example.com",
  "password": "password123"
}
```

#### Get Current User
```http
GET /api/auth/me
Authorization: Bearer {accessToken}
```

#### Update Profile
```http
PUT /api/auth/updatedetails
Authorization: Bearer {accessToken}
Content-Type: application/json

{
  "name": "John Updated",
  "email": "johnupdated@example.com"
}
```

#### Update Password
```http
PUT /api/auth/updatepassword
Authorization: Bearer {accessToken}
Content-Type: application/json

{
  "currentPassword": "oldpassword",
  "newPassword": "newpassword123"
}
```

#### Refresh Token
```http
POST /api/auth/refresh
Content-Type: application/json

{
  "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

### Task Endpoints

#### Get All Tasks
```http
GET /api/tasks?status=todo&priority=high&page=1&limit=10
Authorization: Bearer {accessToken}
```

**Query Parameters:**
- `status` - Filter by status (todo, in-progress, review, completed, cancelled)
- `priority` - Filter by priority (low, medium, high, urgent)
- `category` - Filter by category
- `tags` - Filter by tags (comma-separated)
- `assignedTo` - Filter by assigned user ID
- `createdBy` - Filter by creator user ID
- `project` - Filter by project ID
- `dueBefore` - Filter tasks due before date (ISO 8601)
- `dueAfter` - Filter tasks due after date (ISO 8601)
- `search` - Search in title and description
- `sortBy` - Sort field (default: createdAt)
- `order` - Sort order (asc, desc)
- `page` - Page number (default: 1)
- `limit` - Items per page (default: 10)
- `includeArchived` - Include archived tasks (true/false)

#### Get Single Task
```http
GET /api/tasks/:id
Authorization: Bearer {accessToken}
```

#### Create Task
```http
POST /api/tasks
Authorization: Bearer {accessToken}
Content-Type: application/json

{
  "title": "Implement user authentication",
  "description": "Add JWT-based authentication to the API",
  "status": "todo",
  "priority": "high",
  "category": "backend",
  "tags": ["authentication", "security"],
  "dueDate": "2024-12-31T23:59:59Z",
  "reminderDate": "2024-12-30T09:00:00Z",
  "estimatedTime": 240,
  "assignedTo": ["507f1f77bcf86cd799439011"],
  "project": "507f1f77bcf86cd799439012"
}
```

#### Update Task
```http
PUT /api/tasks/:id
Authorization: Bearer {accessToken}
Content-Type: application/json

{
  "status": "in-progress",
  "progress": 50,
  "actualTime": 120
}
```

#### Delete Task
```http
DELETE /api/tasks/:id
Authorization: Bearer {accessToken}
```

#### Add Comment to Task
```http
POST /api/tasks/:id/comments
Authorization: Bearer {accessToken}
Content-Type: application/json

{
  "text": "This is looking good, keep it up!"
}
```

#### Assign Task to Users
```http
POST /api/tasks/:id/assign
Authorization: Bearer {accessToken}
Content-Type: application/json

{
  "userIds": ["507f1f77bcf86cd799439011", "507f1f77bcf86cd799439013"]
}
```

#### Get Task Statistics
```http
GET /api/tasks/stats/overview
Authorization: Bearer {accessToken}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "byStatus": [
      { "_id": "todo", "count": 15 },
      { "_id": "in-progress", "count": 8 },
      { "_id": "completed", "count": 42 }
    ],
    "byPriority": [
      { "_id": "high", "count": 10 },
      { "_id": "medium", "count": 30 }
    ],
    "overdue": [{ "count": 5 }],
    "dueSoon": [{ "count": 8 }]
  }
}
```

### Project Endpoints

#### Get All Projects
```http
GET /api/projects?status=active&page=1&limit=10
Authorization: Bearer {accessToken}
```

#### Get Single Project
```http
GET /api/projects/:id
Authorization: Bearer {accessToken}
```

#### Create Project
```http
POST /api/projects
Authorization: Bearer {accessToken}
Content-Type: application/json

{
  "name": "Mobile App Development",
  "description": "Develop a cross-platform mobile application",
  "status": "active",
  "startDate": "2024-01-01T00:00:00Z",
  "endDate": "2024-12-31T23:59:59Z",
  "color": "#4A90E2"
}
```

#### Update Project
```http
PUT /api/projects/:id
Authorization: Bearer {accessToken}
Content-Type: application/json

{
  "status": "completed"
}
```

#### Delete Project
```http
DELETE /api/projects/:id
Authorization: Bearer {accessToken}
```

#### Add Member to Project
```http
POST /api/projects/:id/members
Authorization: Bearer {accessToken}
Content-Type: application/json

{
  "userId": "507f1f77bcf86cd799439011",
  "role": "contributor"
}
```

**Member Roles:**
- `viewer` - Can view project and tasks
- `contributor` - Can create and edit tasks
- `manager` - Can manage project and members

#### Remove Member from Project
```http
DELETE /api/projects/:id/members/:userId
Authorization: Bearer {accessToken}
```

#### Get Project Tasks
```http
GET /api/projects/:id/tasks?status=todo&priority=high
Authorization: Bearer {accessToken}
```

### Notification Endpoints

#### Get Notifications
```http
GET /api/notifications?isRead=false&page=1&limit=20
Authorization: Bearer {accessToken}
```

#### Get Unread Count
```http
GET /api/notifications/unread-count
Authorization: Bearer {accessToken}
```

#### Mark Notification as Read
```http
PUT /api/notifications/:id/read
Authorization: Bearer {accessToken}
```

#### Mark All as Read
```http
PUT /api/notifications/read-all
Authorization: Bearer {accessToken}
```

#### Delete Notification
```http
DELETE /api/notifications/:id
Authorization: Bearer {accessToken}
```

## Data Models

### User
```javascript
{
  name: String,
  email: String (unique),
  password: String (hashed),
  role: String (user/admin/manager),
  avatar: String,
  isActive: Boolean,
  emailVerified: Boolean,
  lastLogin: Date,
  createdAt: Date,
  updatedAt: Date
}
```

### Task
```javascript
{
  title: String,
  description: String,
  status: String (todo/in-progress/review/completed/cancelled),
  priority: String (low/medium/high/urgent),
  category: String,
  tags: [String],
  dueDate: Date,
  reminderDate: Date,
  estimatedTime: Number (minutes),
  actualTime: Number (minutes),
  createdBy: ObjectId (User),
  assignedTo: [{
    user: ObjectId (User),
    assignedAt: Date,
    status: String (pending/accepted/declined)
  }],
  project: ObjectId (Project),
  parentTask: ObjectId (Task),
  subtasks: [ObjectId (Task)],
  comments: [{
    user: ObjectId (User),
    text: String,
    createdAt: Date
  }],
  progress: Number (0-100),
  isArchived: Boolean,
  completedAt: Date,
  createdAt: Date,
  updatedAt: Date
}
```

### Project
```javascript
{
  name: String,
  description: String,
  status: String (planning/active/on-hold/completed/cancelled),
  startDate: Date,
  endDate: Date,
  owner: ObjectId (User),
  members: [{
    user: ObjectId (User),
    role: String (viewer/contributor/manager),
    joinedAt: Date
  }],
  color: String,
  isArchived: Boolean,
  createdAt: Date,
  updatedAt: Date
}
```

## Error Handling

The API uses standard HTTP status codes:

- `200` - Success
- `201` - Created
- `400` - Bad Request
- `401` - Unauthorized
- `403` - Forbidden
- `404` - Not Found
- `500` - Internal Server Error

Error Response Format:
```json
{
  "success": false,
  "message": "Error message here",
  "errors": [] // Validation errors if applicable
}
```

## Security Features

- JWT-based authentication
- Password hashing with bcrypt
- Rate limiting (100 requests per 15 minutes)
- Helmet.js for security headers
- CORS configuration
- Input validation and sanitization
- MongoDB injection prevention

## Automated Services

### Reminder Service
- Runs hourly to check for upcoming task reminders
- Creates notifications for tasks with reminders due in the next hour
- Runs daily at midnight to check for overdue tasks

## Testing

```bash
npm test
```

## Deployment

### Environment Variables for Production
Make sure to set secure values for:
- `JWT_SECRET` - Use a strong, random string
- `JWT_REFRESH_SECRET` - Use a different strong, random string
- `MONGODB_URI` - Your production MongoDB connection string
- `NODE_ENV=production`

### Database Indexes
The API automatically creates indexes for optimal query performance on:
- Task status, priority, tags, category, dueDate
- User assignments
- Project ownership and membership

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## License

This project is licensed under the ISC License.

## Support

For support, email support@taskmanager.com or open an issue in the repository.