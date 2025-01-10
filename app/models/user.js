import Basemodel from "./basemodel.js";
import bcrypt from "bcryptjs";

class User extends Basemodel {
  static collection = "users";

  /**
   * Constructor to initialize a new User instance.
   *
   * @param {string} name - The name of the user.
   * @param {string} email - The email address of the user.
   * @param {string} password - The hashed password of the user.
   * @param {...object} kwargs - Additional fields to pass to the base model.
   */
  constructor(name, email, password, kwargs = {}) {
    super(kwargs); // Initialize base model fields
    this.name = name;
    this.email = email;
    this.password = password; // Already hashed password
  }

  /**
   * Factory method to create a new User instance.
   *
   * @param {string} name - The name of the user.
   * @param {string} email - The email address of the user.
   * @param {string} password - The raw password to hash.
   * @param {...object} kwargs - Additional fields to pass to the base model.
   * @returns {Promise<User>} - A promise that resolves to a new User instance.
   */
  static async create(name, email, password, kwargs = {}) {
    const hashedPassword = await bcrypt.hash(password, 10);
    return new User(name, email, hashedPassword, kwargs);
  }

  /**
   * Verifies if a provided password matches the stored hashed password.
   *
   * @param {string} password - The raw password to verify.
   * @returns {Promise<boolean>} - Returns true if passwords match, false otherwise.
   */
  async verifyPassword(password) {

    if(!this.password){
      throw new Error("User does not have a password");
    }
    return bcrypt.compare(password, this.password);
  }


  /**
   * Check the user in the database matching email and password
   * @param {string} email - The email of the user
   * @param {string} password - The raw password to verify
   * @returns {Promise<Basemodel>} - The user instance from the database
   */
  static async checkUser(email, password){
    const hashedPassword = await bcrypt.hash(password, 10);
    return await super.get({email, password:hashedPassword});
  }

    /**
     * Update an instance in the database.
     * @param {object} updateObject - The fields to be updated.
     * @returns {Promise<any>} - The result of the update operation.
     */
    async updateInstance(updateObject) {

      const {password} = updateObject;
      if (password){
        const hashedPassword = await bcrypt.hash(password, 10);
        updateObject["password"] = hashedPassword;
      }
      return this.execute(() => {
          return storage.update(this.constructor.collection, { id: this.id }, updateObject);
      });
  }


  /**
   * Converts the User instance to a plain JavaScript object,
   * excluding sensitive fields like the password.
   *
   * @returns {object} - The user object without sensitive information.
   */
  to_object() {
    const obj = super.to_object(); // Get base model fields
    obj.name = this.name;
    obj.email = this.email;
    obj.password = this.password;
    // delete obj.password; // Exclude password from the output
    return obj;
  }
}

export default User;
