#!/usr/bin/env python3
"""
The console module is the entry point for the application.
"""
from asyncio import Event
import cmd
import os
from pprint import pprint

from models.candidate import Candidate
from models.category import Category
from models.nomination import Nomination
from models.vote import Vote
from models.role import Role
from models.user import User

classes = {"user": User, "role": Role,
            "event": Event, "nomination": Nomination, "vote": Vote, 
            "category": Category, "candidate": Candidate}

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
        except Exception as e:
            print("Command not found.\nDid you use spaces in your parameters?\nTry replacing spaces with `_`.")

    def _require_login(self):
        """Check if a user is logged in before performing any action."""
        if not self.current_user:
            print("Please login first to perform this action.")
            return False
        return True

    def do_login(self, arg):
        """Login to the system: login
        Example:
        -------
        email=john@example.com password=password
        or
        key=STRONG_DEFAULT_KEY
        """
        print("Login required. Type 'exit' to quit.")
        if len(arg) == 0:
            print("Please provide login credentials.")
            return

        credentials = self._key_value_parser(arg)

        if 'key' in credentials:
            if credentials['key'] == self.default_key:
                self.is_key_holder = True
                self.current_user = {"name": "superuser"}
                self.prompt = f"{self.current_user['name']}@(user-mgmt)# "
                print("Logged in as superuser with full privileges.")
                return
            else:
                print("Invalid key.")
                return

        email = credentials.get('email')
        password = credentials.get('password')
        if email is None or password is None:
            print("Please provide email and password.")
            return

        user = User.get({"email": email})
        if user:
            verify_pwd = User.verify_password(password)
            if verify_pwd:
                self.is_key_holder = False
                self.current_user = user
                self.current_role = Role.get({"id": user["roleId"]})
                self.prompt = f"{self.current_user['name']}@(user-mgmt)# "
                print(f"Logged in as {user['name']}.")
            else:
                print("Invalid password.")
        else:
            print("Invalid credentials. Please try again.")

    def do_logout(self, arg):
        """Logout the current user: logout"""
        self.current_user = None
        self.is_key_holder = False
        self.current_role = None
        self.prompt = "(user-mgmt)# "
        print("Logged out.")

    def do_create(self, arg):
        """Create a new document or entity.
        Example:
        -------
        create user name=John email=email password=password 
        """
        if not self._require_login():
            return

        if len(arg) == 0:
            print("Please provide the entity to create.")
            return

        entity, *args = arg.split()
        if entity not in classes:
            print(f"Invalid entity: {entity}")
            return

        entity_class = classes[entity]
        entity_instance = entity_class(**self._key_value_parser(' '.join(args)))
        entity_instance.save()
        print(f"{entity} created:")
        pprint(entity_instance.to_dict())

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
        print((args))
        if entity not in classes:
            print(f"Invalid entity: {entity}")
            return

        if 'all' in args:
            confirmation = input(
                f"Are you sure you want to delete all {entity}s? This action cannot be undone. (yes/no): "
            ).strip().lower()
            if confirmation == "yes":
                args.pop(args.index('all'))
                query = self._key_value_parser(' '.join(args))
                entity_class = classes[entity]

                entity_class.deleteMany(query or {})
                print(f"All {entity}s have been deleted.")
            else:
                print("Action canceled.")
            return

        entity_class = classes[entity]
        entity_query = self._key_value_parser(' '.join(args))
        if not entity_query:
            print("Query is empyt pass a query like `id=someid`")
        entity_instance = entity_class.get(entity_query)
        if entity_instance:
            print(f"{entity} with {entity_query} not found")
            return

        confirmation = input(
            f"Are you sure you want to delete {entity} with {entity_query}? (yes/no): "
        ).strip().lower()
        if confirmation == "yes":
            entity_instance.delete(entity_query)
            print(f"{entity} deleted:")
            pprint(entity_instance.to_dict())
        else:
            print("Action canceled.")

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

    def do_clear(self, arg):
        """Clears the terminal."""
        os.system('cls' if os.name == 'nt' else 'clear')

if __name__ == "__main__":
    UserManagementApp().cmdloop()
