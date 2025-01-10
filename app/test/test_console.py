import unittest
from unittest.mock import patch, MagicMock
from app.console2 import UserManagementApp, classes

class TestUserManagementApp(unittest.TestCase):

    def setUp(self):
        self.app = UserManagementApp()
        self.app.stdout = MagicMock()

    @patch('models.user.User.get', return_value=None)
    def test_login_with_invalid_email(self, mock_get):
        with patch('builtins.print') as mock_print:
            self.app.onecmd('login email=invalid@example.com password=test')
            mock_print.assert_any_call("Error: Invalid email or password.")

    @patch('models.user.User.get', return_value={'email': 'john@example.com', 'password': 'hashed_pwd'})
    @patch('models.user.User.verify_password', return_value=True)
    def test_login_with_valid_credentials(self, mock_verify, mock_get):
        with patch('builtins.print') as mock_print:
            self.app.onecmd('login email=john@example.com password=correct_password')
            mock_print.assert_any_call("Logged in as john@example.com.")

    def test_logout(self):
        with patch('builtins.print') as mock_print:
            self.app.onecmd('logout')
            mock_print.assert_any_call("Logged out.")

    @patch('models.user.User.get', return_value=None)
    def test_assign_role_user_not_found(self, mock_get):
        with patch('builtins.print') as mock_print:
            self.app.onecmd('assign_role user_id=999 role_name=admin')
            mock_print.assert_any_call("Error: User with 999 not found.")

    @patch('models.role.Role.get', return_value=None)
    @patch('models.user.User.get', return_value={'id': '123', 'name': 'John'})
    def test_assign_role_role_not_found(self, mock_user_get, mock_role_get):
        with patch('builtins.print') as mock_print:
            self.app.onecmd('assign_role user_id=123 role_name=nonexistent')
            mock_print.assert_any_call("Error: Role nonexistent not found.")

    @patch('models.user.User.get', return_value={'id': '123', 'name': 'John'})
    @patch('models.role.Role.get', return_value={'id': '456', 'name': 'admin'})
    @patch('models.user.User.update')
    def test_assign_role_success(self, mock_update, mock_role_get, mock_user_get):
        with patch('builtins.print') as mock_print:
            self.app.onecmd('assign_role user_id=123 role_name=admin')
            mock_print.assert_any_call("Role admin assigned to user John.")

    @patch('models.user.User.get', return_value=None)
    def test_create_user_already_exists(self, mock_get):
        with patch('builtins.print') as mock_print:
            self.app.onecmd('create user name=John email=john@example.com password=1234')
            mock_print.assert_any_call("Error: user already exists.")

    @patch('models.user.User.save', return_value=None)
    @patch('models.user.User.get', return_value=None)
    def test_create_user_success(self, mock_get, mock_save):
        with patch('builtins.print') as mock_print:
            self.app.onecmd('create user name=John email=john@example.com password=1234')
            mock_print.assert_any_call("User created:")

if __name__ == "__main__":
    unittest.main()
