$(document).ready(function () {

    const loginButton = "";

    const url = "127.0.0.1:6000/api/v1/login";

    $.ajax({
        type: 'POST',
        url: url,
        data: JSON.stringify({email: "johnamete@gmail.com", password: "Hope12345"}),
        contentType: 'application/json',
        success: function (data){
            const accessToken = data["accessToken"];

        },
        error: function (error) {
            console.error(error);
        }
    })

})