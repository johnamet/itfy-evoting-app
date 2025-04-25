#!/usr/bin/env python3
"""
The console module is the entry point for the application.
This CLI tool allows administrators to manage users, roles, events, nominations, votes, and categories
for an e-voting system. It supports login, role assignment, creation, deletion, and listing of entities.

Commands include:
- `login`: Authenticate a user or a key-holder.
- `logout`: Logout the current user.
- `assign_role`: Assign a role to a user.
- `create`: Create a new entity.
- `delete`: Delete an entity or all entities.
- `update`: Update an entity's attributes.
- `list`: List entities with optional filters.
- `clear`: Clear the terminal.
- `exit` / `EOF`: Exit the CLI.

Proper error handling and detailed usage instructions are included for each command.
"""
import cmd
import os
import sys
import logging
from pprint import pprint

from models.candidate import Candidate
from models.category import Category
from models.nomination import Nomination
from models.vote import Vote
from models.role import Role
from models.user import User
from models.event import Event

# Configure logging
logging.basicConfig(
    filename="user_mgmt_app.log",
    level=logging.ERROR,
    format="%(asctime)s - %(levelname)s - %(message)s"
)

# Mapping of entities to their respective classes
classes = {
    "user": User,
    "role": Role,
    "event": Event,
    "nomination": Nomination,
    "vote": Vote,
    "category": Category,
    "candidate": Candidate
}

class UserManagementApp(cmd.Cmd):
    prompt = "(user-mgmt)# "
    current_user = None
    is_key_holder = False
    current_role = None
    default_key = "STRONG_DEFAULT_KEY"
    intro = "Welcome to the E-voting User Management CLI. Please login to begin.\n"

    def _key_value_parser(self, arg):
        """Parse key-value pairs from the command line."""
        try:
            arg_list = arg.split()
            return dict(
                [
                    pair.split('=')[0],
                    pair.split('=')[1].replace('_', ' ') if pair.split('=')[0] != "key" else pair.split("=")[1],
                ]
                for pair in arg_list
            )
        except ValueError:
            print("Error: Invalid key-value format. Use key=value syntax. Replace spaces in values with `_`.")
            logging.error("Key-value parsing failed for input: %s", arg)
            return {}
        except Exception as e:
            logging.error("Key-value parsing failed: %s", str(e))
            print(f"Syntax Error: {str(e)}")
            return {}

    def _require_login(self):
        """Check if a user is logged in before performing any action."""
        if not self.current_user:
            print("Error: Please login first to perform this action.")
            return False
        return True

    def _error_usage(self, command):
        """Display usage information when an error occurs."""
        print(f"Usage: {getattr(self, f'do_{command}').__doc__.strip()}\n")

    def do_login(self, arg):
        """
        Login to the system.
        Usage:
        -------
        login key=STRONG_DEFAULT_KEY
        or
        login email=john@example.com password=password
        """
        if not arg:
            print("Error: Missing credentials.")
            self._error_usage("login")
            return

        credentials = self._key_value_parser(arg)

        if 'key' in credentials:
            if credentials['key'] == self.default_key:
                self.is_key_holder = True
                self.current_user = {"name": "superuser"}
                self.prompt = f"{self.current_user['name']}@(user-mgmt)# "
                print("Logged in as superuser with full privileges.")
            else:
                print("Error: Invalid key.")
                self._error_usage("login")
            return

        email = credentials.get('email')
        password = credentials.get('password')
        if not email or not password:
            print("Error: Both email and password are required.")
            self._error_usage("login")
            return

        try:
            user = User.get({"email": email})
            if user and User(**user).verify_password(password):
                self.is_key_holder = False
                self.current_user = user
                self.current_role = Role.get({"id": user["roleId"]})
                self.prompt = f"{self.current_user['name']}@(user-mgmt)# "
                print(f"Logged in as {user['name']}.")
            else:
                print("Error: Invalid email or password.")
                self._error_usage("login")
        except Exception as e:
            logging.error("Login failed: %s", str(e))
            print(f"Error: {str(e)}")
            self._error_usage("login")

    def do_logout(self, arg):
        """
        Logout the current user.
        Usage:
        -------
        logout
        """
        self.current_user = None
        self.is_key_holder = False
        self.current_role = None
        self.prompt = "(user-mgmt)# "
        print("Logged out.")

    def do_assign_role(self, arg):
        """
        Assign a role to a user.
        Usage:
        -------
        assign_role user_id=12345 role_name=admin
        or
        assign_role user_email=john@example.com role_id=67890
        """
        if not self._require_login():
            return

        if not self.is_key_holder:
            print("Error: Only the key-holder can perform this action.")
            return

        if not arg:
            print("Error: Missing parameters.")
            self._error_usage("assign_role")
            return

        params = self._key_value_parser(arg)
        user_crd = params.get("user_id") or params.get("user_email")
        role_name = params.get("role_id") or params.get("role_name")

        if not user_crd or not role_name:
            print("Error: Both user and role information are required.")
            self._error_usage("assign_role")
            return

        user = User.get({"id": user_crd}) if "user_id" in params else User.get({"email": user_crd})
        if not user:
            print(f"Error: User with {user_crd} not found.")
            self._error_usage("assign_role")
            return

        role = Role.get({"id": role_name}) if "role_id" in params else Role.get({"name": role_name})
        if not role:
            print(f"Error: Role {role_name} not found.")
            self._error_usage("assign_role")
            return

        try:
            user = User(**user)
            user.update({"roleId": role["id"]})
            print(f"Role {role['name']} assigned to user {user.name}.")
        except Exception as e:
            logging.error("Failed to assign role: %s", str(e))
            print(f"Error: {str(e)}")
            self._error_usage("assign_role")

    def do_create(self, arg):
        """
        Create a new document or entity.
        Usage:
        -------
        create user name=John email=john@example.com password=strongpassword
        """
        if not self._require_login():
            return

        if not arg:
            print("Error: Missing entity and attributes.")
            self._error_usage("create")
            return

        entity, *args = arg.split()
        if entity not in classes:
            print(f"Error: Invalid entity '{entity}'.")
            self._error_usage("create")
            return

        entity_class = classes[entity]
        params = self._key_value_parser(' '.join(args))
        try:
            existing_entity = entity_class.get({"email": params.get("email")}) if entity == "user" else None
            if existing_entity:
                print(f"Error: {entity} already exists.")
                self._error_usage("create")
                return
            entity_instance = entity_class(**params)
            entity_instance.save()
            print(f"{entity.capitalize()} created:")
            pprint(entity_instance.to_dict())
        except Exception as e:
            logging.error("Failed to create entity: %s", str(e))
            print(f"Error: {str(e)}")
            self._error_usage("create")

    def do_list(self, arg):
        """List all documents or entities with optional query parameters.
        Example:
        -------
        list user
        or
        list role
        or list user name=John
        """
        if not self._require_login():
            return

        entity_query = {}
        entity, *args = arg.split()
        if entity not in classes:
            print(f"Invalid entity: {entity}")
            return

        if len(args) > 0:
            entity_query = self._key_value_parser(' '.join(args))

        entity_class = classes[entity]
        entities = entity_class.all(entity_query)
        if entities:
            print(f"Listing all {entity}s:")
            for entity_instance in entities:
                pprint(entity_instance)
        else:
            print(f"No {entity}s found.")

    def do_update_role_permissions(self, arg):
        """
        Update the permissions of a role.
        Usage:
        -------
        update_role_permissions role_id=<role_id> permissions=perm1,perm2,perm3
        or
        update_role_permissions role_name=<role_name> permissions=perm1,perm2,perm3
        """
        if not self._require_login():
            return

        if not self.is_key_holder:
            print("Error: Only the key-holder can update role permissions.")
            return

        if not arg:
            print("Error: Missing parameters.")
            self._error_usage("update_role_permissions")
            return

        # Parse key-value pairs from the arguments.
        params = self._key_value_parser(arg)
        role_identifier = params.get("role_id") or params.get("role_name")
        permissions_str = params.get("permissions")
        if not role_identifier or not permissions_str:
            print("Error: Both role identifier and permissions are required.")
            self._error_usage("update_role_permissions")
            return

        # Retrieve the role by id (if provided) or by name.
        from models.role import Role  # Ensure Role is imported if not already.
        role = Role.get({"id": role_identifier}) if params.get("role_id") else Role.get({"name": role_identifier})
        if not role:
            print(f"Error: Role with identifier '{role_identifier}' not found.")
            return

        # Parse permissions; assume a comma-separated string.
        permissions = [perm.strip() for perm in permissions_str.split(",") if perm.strip()]
        if not permissions:
            print("Error: No valid permissions provided.")
            self._error_usage("update_role_permissions")
            return

        try:
            # Transform the retrieved role into a Role instance and update its permissions.
            role_instance = Role(**role)
            role_instance.update({"permissions": permissions})
            print(f"Role '{role_instance.name}' updated with permissions: {', '.join(permissions)}")
        except Exception as e:
            print(f"Error updating role permissions: {str(e)}")
            logging.error("Failed to update role permissions: %s", str(e))
            self._error_usage("update_role_permissions")



    def do_delete(self, arg):
        """Delete an existing document or entity.
        Example:
        -------
        delete user id=12345
        or
        delete user all
        """
        if not self._require_login():
            return

        if not self.is_key_holder:
            print("Only the key-holder can perform delete operations.")
            return

        if len(arg) == 0:
            print("Please provide the entity to delete.")
            return

        entity, *args = arg.split()
        if entity not in classes:
            print(f"Invalid entity: {entity}")
            return

        if 'all' in args:
            confirmation = input(
                f"Are you sure you want to delete all {entity}s? This action cannot be undone. (yes/no): "
            ).strip().lower()
            if confirmation == "yes":
                args.remove('all')

                params = self._key_value_parser(' '.join(args))
                entity_class = classes[entity]
                entity_class.deleteMany(params or {})
                print(f"All {entity}s have been deleted.")
            else:
                print("Action canceled.")
            return

        entity_class = classes[entity]
        entity_query = self._key_value_parser(' '.join(args))

        if not entity_query:
            print("Please provide a valid query to delete.")
            return
        
        entity_instance = entity_class.get(entity_query)
        if entity_instance is None:
            print(f"{entity} with {entity_query} not found")
            return

        confirmation = input(
            f"Are you sure you want to delete {entity} with {entity_query}? (yes/no): "
        ).strip().lower()
        if confirmation == "yes":
            entity_instance = entity_class(**entity_instance)
            entity_instance.delete(entity_query)
            print(f"{entity} deleted:")
            pprint(entity_instance.to_dict())
        else:
            print("Action canceled.")

    def do_exit(self, arg):
        """
        Exit the application.
        Usage:
        -------
        exit
        """
        print("Exiting User Management CLI.")
        return True

    def do_clear(self, arg):
        """
        Clears the terminal.
        Usage:
        -------
        clear
        """
        os.system('cls' if os.name == 'nt' else 'clear')

if __name__ == "__main__":
    app = UserManagementApp()
    if len(sys.argv) > 1:
        if sys.argv[1] == "login":
            login_args = ' '.join(sys.argv[2:])
            app.onecmd(f"login {login_args}")
        else:
            print("Error: First command must be 'login'")
            sys.exit(1)

    if not sys.stdin.isatty():
        for line in sys.stdin:
            app.onecmd(line.strip())
    else:
        app.cmdloop()
