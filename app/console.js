#!/usr/bin/env node
import readline from 'readline';
import generateStrongPassword from './utils/passwordGenerator.js';
import User from './models/user.js';
import Role from './models/role.js';

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

const createUser = async () => {
  rl.question('Enter user name: ', async (name) => {
    rl.question('Enter user email: ', async (email) => {
      const password = generateStrongPassword();
      const user = new User(name, email, password);
      await user.save();
      console.log(`User created: ${JSON.stringify(user.to_object(), null, 2)} with password ${password}`);
      rl.close();
    });
  });
};

const createRole = async () => {
  rl.question('Enter role name: ', async (name) => {
    const existingRole = await Role.get({name: name})

    if (existingRole){
        console.log(`Role with name ${name} exists`);
    }
    rl.question('Enter role description: ', async (description) => {
        
      const role = new Role(name, description);
      await role.save();
      console.log(`Role created: ${JSON.stringify(role, null, 2)}`);
      rl.close();
    });
  });
};

const assignRoleToUser = async () => {
  rl.question('Enter user email: ', async (email) => {
    rl.question('Enter role name: ', async (roleName) => {
      const user = await User.get({ email });
      const role = await Role.get({ name: roleName });
      if (user && role) {
        await user.updateInstance({ roleId: role.id });
        console.log(`Role ${roleName} assigned to user ${email}`);
      } else {
        console.log('User or role not found');
      }
      rl.close();
    });
  });
};

const main = () => {
  rl.question('Choose an action: (1) Create User, (2) Create Role, (3) Assign Role to User: ', (choice) => {
    switch (choice) {
      case '1':
        createUser();
        break;
      case '2':
        createRole();
        break;
      case '3':
        assignRoleToUser();
        break;
      default:
        console.log('Invalid choice');
        rl.close();
    }
  });
};

main();
