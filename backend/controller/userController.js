import { User } from "../models/User.model.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { sendMail } from "../utils/SendMail.js";
import { getNextSequenceValue } from "../utils/functions.js";

const registerUser = async (req, res) => {

    const { firstName, lastName, email, mobileNumber, departmentId } = req.body

    if(!firstName || !lastName || !email || !mobileNumber || !departmentId){
        return res.status(400).json(
            new ApiResponse(400, {}, "All fields are required")
        )
    }
   
    const existedUser = await User.findOne({ email })

    if (existedUser) {
        return res.status(409).json(
            new ApiResponse(409, {}, "User with email already existsd")
        )
    }

    const UID= await getNextSequenceValue("userId");

    const user = new User({
        userId: "EMP_" + UID,
        firstName,
        lastName,
        email,
        mobileNumber,
        password: generatePassword(),
        departmentId
    })

    let registeredUser = await user.save();

    if (!registeredUser) {
        return res.status(500).json(
            new ApiResponse(500, {}, "Something went wrong while registering the user")
        )
    }

    const subject="Employee Register Successfull"
    const body = `Hi ${user.firstName}<br/>
     Here is the your cedientials for login<br/>
     email: ${user.email}<br/>
     password: ${user.password}<br/>
    click here to login: <a href="http://localhost:3000">http://localhost:3000</a>`;

    sendMail(registeredUser.email,subject,body);

    return res.status(201).json(
        new ApiResponse(201, registeredUser, "User registered Successfully")
    )
};

function generatePassword() {
    var length = 8,
        charset = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789",
        retVal = "";
    for (var i = 0, n = charset.length; i < length; ++i) {
        retVal += charset.charAt(Math.floor(Math.random() * n));
    }
    return retVal;
}

const generateAccessToken = async(userId) =>{
    try {
        const user = await User.findById(userId)
        const accessToken = user.generateAccessToken()

        return {accessToken}
    } catch (error) {
        return res.status(500).json(
            new ApiResponse(500, {}, "Something went wrong while generating referesh and access token")
        )
    }
}

const loginUser = async (req, res) => {
    const { email, password } = req.body;

    if (!email && !password) {
        return res.status(400).json(
            new ApiResponse(400, {}, "Email and password is required")
        )
    }

    const user = await User.findOne({ email });

    if (!user) {
        return res.status(404).json(
            new ApiResponse(404, {}, "User does not exist")
        )
    }

    if (password !== user.password) {
        return res.status(401).json(
            new ApiResponse(401, {}, "Invalid user credentials")
        )
    }

    const { accessToken } = await generateAccessToken(user._id)

    const options = {
        domain: "localhost",
        sameSite: "none",
        secure: true,
        maxAge: 1*24*60*60*1000
    }

    return res
        .status(200)
        .cookie("accessToken", accessToken, options)
        .json(
            new ApiResponse(
                200,
                {
                    user: user, accessToken,
                },
                "User logged In Successfully"
            )
        )
}

const resetPassword = async (req, res) => {
    const {password, confirmPassword} = req.body;

    if(password !== confirmPassword){
        return res.status(401).json(
            new ApiResponse(401, {}, "Password doesn't match")
        )
    }

    try {
        User.updateOne({ userId: req.user.userId }, { password });

        return res.status(200).json(
            new ApiResponse(200, {}, "Password reset")
        )

    } catch (error) {
         return res.status(500).json(
            new ApiResponse(500, {}, "Error while reset password")
        )
    }
}

const logoutUser = async (req, res) => {
    const options = {
        httpOnly: true,
        secure: true
    }
    return res
    .status(200)
    .clearCookie("accessToken", options)
    .json(new ApiResponse(200, {}, "User logged Out"))
}

const deleteUser = async (req, res) => {
    const userId = req.params.userId;
    if(!userId){
        return res.status(401).json(
            new ApiResponse(401, {}, "User Id is required to delete user")
        )
    }
    try {
        const user = await User.findOne({userId});

        if(!user){
            return res.status(404).json(
                new ApiResponse(404, {}, "User not found with Id: "+userId)
            )
        }

        await User.deleteOne({userId});

        return res.status(200).json(
            new ApiResponse(200, {}, "User deleted with Id: "+userId)
        )

      } catch (err) {
          return res.status(500).json(
              new ApiResponse(500, {}, "Error! while deleting user.")
          )
      }
}

const updateUser = async(req, res)=>{
    const userId = req.params.userId;
    
    const { firstName, lastName, email, mobileNumber, departmentId } = req.body

    if(!userId || !firstName || !lastName || !email || !mobileNumber || !departmentId){
        return res.status(400).json(
            new ApiResponse(400, {}, "All fields are required")
        )
    }
    try {
        const user = await User.findOne({userId});

        if(!user){
            return res.status(404).json(
                new ApiResponse(404, {}, "User not found with Id: "+userId)
            )
        }
    
        await User.updateOne({userId}, {
            firstName, lastName, email, mobileNumber, departmentId: +departmentId
        });
    
        return res.status(201).json(
            new ApiResponse(201, {userId, firstName, lastName, email, mobileNumber, departmentId: +departmentId}, "User updated Successfully")
        )
    } catch (error) {
        return res.status(500).json(
            new ApiResponse(500, {}, "Something went wrong while updating the user")
        )
    }
}

const forgotPassword = async(req,res)=>{
    const { email } = req.body;

    if (!email) {
        return res.status(400).json(
            new ApiResponse(400, {}, "Email is required")
        )
    }


    const user = await User.findOne({ email });

    if (!user) {
        return res.status(404).json(
            new ApiResponse(404, {}, "User does not exist")
        )
    }

    const subject="Forgot Password"
    const body = `Hi ${user.firstName}<br/>
     email: ${user.email}<br/>
     you have requested for reset password<br/>
    click here to create a new password: <a href="http://localhost:3000/resetPassword">http://localhost:3000/resetPassword</a>`;

    sendMail(user.email,subject,body)
    return res.status(201).json(
        new ApiResponse(201,{}, "Email Send Successfully")
    )
}

const getAllUsers = async (req, res) => {
    const conditon = {};
    if(req.query.departmentId){
        conditon.departmentId = +req.query.departmentId
    }
    try {
      const users = await User.aggregate([
        {
            $match: conditon
        },
        {
            $lookup:
              {
                from: "departments",
                localField: "departmentId",
                foreignField: "deptId",
                as: "department"
              }
         },
         {
            $unwind:"$department"
         },
         {
            $project: {
                _id:1,
                userId:1,
                firstName:1,
                lastName:1,
                email:1,
                mobileNumber:1,
                departmentId:1,
                department:'$department.deptName'
            }
         }
    ]);
      return res.status(201).json(
        new ApiResponse(201, users, "Users data fetched Successfully")
    )
    } catch (err) {
        return res.status(500).json(
            new ApiResponse(500, {}, "Error! while fetching users.")
        )
    }
  };
export { registerUser, loginUser, logoutUser,forgotPassword,resetPassword, getAllUsers, deleteUser, updateUser };