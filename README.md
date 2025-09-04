# Schedule

A modern, responsive web application for managing your daily tasks and schedule with user authentication.

## Features

### 🔐 **User Authentication**
- **Secure Login/Signup** - Create your personal account
- **User-specific Data** - Your tasks are private and saved per user
- **Session Management** - Stay logged in across browser sessions
- **Demo Account** - Try it out with `demo@example.com` / `demo123`

### 📅 **Calendar View (Home Page)**
- **Monthly Calendar** - Navigate through months with intuitive controls
- **Task Overview** - See all your tasks at a glance on each date
- **Date Selection** - Click any date to view/manage tasks for that day
- **Visual Indicators** - Color-coded task status (pending/completed)
- **Task Management** - Add, edit, complete, and delete tasks

### ⏰ **Today's Focus (Today Page)**
- **Daily Timeline** - Time-ordered view of today's tasks
- **Progress Tracking** - Visual progress bar and statistics
- **Interactive Tasks** - Check off tasks as you complete them
- **Time Display** - Clear time formatting for scheduled tasks
- **Completed Tasks** - Separate section for finished work

### 🛠 **Task Management**
- **Rich Task Creation** - Add title, description, and time
- **Real-time Sync** - Tasks automatically sync between Calendar and Today views
- **Persistent Storage** - Your data is saved locally and per-user
- **Responsive Design** - Works great on desktop and mobile

## Getting Started

### Prerequisites
- Node.js (v14 or higher)
- npm or yarn

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/snowy615/Schedule.git
   cd Schedule
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Start the development server**
   ```bash
   npm run dev
   ```

4. **Open your browser**
   - Navigate to `http://localhost:5173` (or the port shown in terminal)
   - Create an account or use the demo credentials

### Demo Login
- **Email:** demo@example.com
- **Password:** demo123

## Usage

### Authentication
1. **Sign Up** - Create a new account with your email and password
2. **Sign In** - Log in to access your personal schedule
3. **Logout** - Use the logout button in the navigation bar

### Managing Tasks
1. **Add Tasks** - Click "Add Task" on either page
2. **Set Time** - Optional time scheduling for better organization
3. **Mark Complete** - Check the checkbox to mark tasks as done
4. **Delete Tasks** - Click the × button to remove tasks
5. **Switch Views** - Use Calendar for monthly view, Today for daily focus

### Navigation
- **Calendar** - Monthly calendar with task overview
- **Today** - Focus on today's schedule and progress
- **User Menu** - See your name and logout option

## Technology Stack

- **Frontend:** React 18 with Hooks
- **Routing:** React Router 6
- **Styling:** CSS3 with CSS Variables
- **Icons:** Lucide React
- **Date Handling:** date-fns
- **Build Tool:** Vite
- **Storage:** localStorage (user-specific)

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License.

## Future Enhancements

- [ ] Backend API integration
- [ ] Real-time collaboration
- [ ] Task categories and tags
- [ ] Email reminders
- [ ] Export/Import functionality
- [ ] Dark/Light theme toggle
- [ ] Mobile app version
