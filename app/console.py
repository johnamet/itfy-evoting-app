import cmd
import os
from models.user import User
from models.role import Role


class UserManagementApp(cmd.Cmd):
    intro = "Welcome to the User Management CLI. Please login to begin.\n"
    prompt = "(user-mgmt) "
    current_user = None
    is_key_holder = False
    default_key = "STRONG_DEFAULT_KEY"

    def preloop(self):
        """Override preloop to force login before any command can be executed."""
        while not self.current_user:
            self.do_login("")

    def do_login(self, arg):
        """Login to the system: login"""
        print("Login required. Type 'exit' to quit.")
        email_or_key = input("Enter email or key: ").strip()

        # Check for key-holder login
        if email_or_key == self.default_key:
            self.is_key_holder = True
            self.current_user = {"name": "Key Holder"}
            print("Logged in as Key Holder with full privileges.")
            return

        # Check for email/password login
        email = email_or_key
        password = input("Enter password: ").strip()
        user = User.get({"email": email, "password": password})  # Assuming passwords are stored securely
        if user:
            self.is_key_holder = False
            self.current_user = user
            print(f"Logged in as {user['name']}.")
        else:
            print("Invalid credentials. Please try again.")

    def do_logout(self, arg):
        """Logout the current user: logout"""
        self.current_user = None
        self.is_key_holder = False
        print("Logged out.")
        self.preloop()

    def do_create_user(self, arg):
        """Create a new user: create_user"""
        name = input("Enter user name: ")
        email = input("Enter user email: ")
        password = input("Enter user password: ")
        user = User(name, email, password)
        user.save()
        print(f"User created: {user.to_dict()}")

    def do_create_role(self, arg):
        """Create a new role: create_role"""
        name = input("Enter role name: ")
        existing_role = Role.get({"name": name})
        if existing_role:
            print("Role already exists")
            return

        description = input("Enter role description: ")
        role = Role(name, description)
        role.save()
        print(f"Role created: {role.to_dict()}")

    def do_check_user_role(self, arg):
        """Check a user's role: check_user_role"""
        email = input("Enter user email: ")
        user = User.get({"email": email})
        if user:
            role = Role.get({"_id": user["roleId"]})
            print(f"User {email} has role: {role['name']}")
        else:
            print("User not found")

    def do_assign_role(self, arg):
        """Assign a role to a user: assign_role"""
        if not self.is_key_holder:
            print("Only the key-holder can assign roles.")
            return

        email = input("Enter user email: ")
        role_name = input("Enter role name: ")
        user = User.get({"email": email})
        role = Role.get({"name": role_name})
        if user and role:
            user.update({"roleId": role["id"]})
            print(f"Role {role_name} assigned to user {email}")
        else:
            print("User or role not found")

    def do_list_users(self, arg):
        """List all users: list_users"""
        users = User.all()
        if users:
            print("Listing all users:")
            for user in users:
                print(user)
        else:
            print("No users found.")

    def do_delete_user(self, arg):
        """Delete a user or all users: delete_user [email | all]"""
        if not self.is_key_holder:
            print("Only the key-holder can perform delete operations.")
            return

        if arg.strip().lower() == "all":
            confirmation = input(
                "Are you sure you want to delete all users? This action cannot be undone. (yes/no): "
            ).strip().lower()
            if confirmation == "yes":
                User.delete_all()
                print("All users have been deleted.")
            else:
                print("Action canceled.")
        else:
            email = arg.strip()
            if not email:
                print("Please specify an email or use 'all'.")
                return

            user = User.get({"email": email})
            if user:
                User.delete({"email": email})
                print(f"User with email {email} has been deleted.")
            else:
                print(f"No user found with email {email}.")

    def do_clear(self, arg):
        """Clear the terminal screen: clear"""
        os.system('cls' if os.name == 'nt' else 'clear')

    def do_exit(self, arg):
        """Exit the program: exit"""
        print("Goodbye!")
        return True


if __name__ == "__main__":
    UserManagementApp().cmdloop()
