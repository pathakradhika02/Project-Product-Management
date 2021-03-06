const cartModel = require("../models/cartModel")
const productModel = require("../models/productModel")
const userModel = require("../models/userModel")
const orderModel = require("../models/orderModel")
const validator = require("../validators/validator")
const { findOne } = require("../models/cartModel")

const createOrder = async (req, res) => {
    try {
        const userId = req.params.userId;

        const data = req.body
        if (Object.keys(data) == 0) { return res.status(400).send({ status: false, message: 'Please provide request Body' }) }
        const { items, cancellable } = data

        const finalData = {}

        if (Object.keys(userId) == 0) return res.status(400).send({ status: false, message: 'Please provide user Id' })
        if (!validator.isValidID(userId)) return res.status(400).send({ status: false, message: 'Please provide a valid user Id' })

        const userMatch = await userModel.findOne({ _id: userId })
        if (!userMatch) return res.status(404).send({ status: false, message: `No user found with this id ${userId}` })

        //  CHECK : is product available

        let totalPrice = 0
        let totalItems = items.length
        let totalQuantity = 0
        for (let i = 0; i < items.length; i++) {

            if (!validator.isValid(items[i].productId)) return res.status(400).send({ status: false, message: `Please provide productId at position ${i + 1}` })
            if (!validator.isValidID(items[i].productId)) return res.status(400).send({ status: false, message: `Please provide Valid productId at position ${i + 1}` })

            let isProductAvailable = await productModel.findOne({ _id: items[i].productId })
            if (!isProductAvailable) return res.status(400).send({ status: false, message: `Product doesn't Exist for ProductId ${items[i].productId} at position ${i + 1}` })

            if (!validator.isValid(items[i].quantity)) return res.status(400).send({ status: false, message: `Please provide quantity at position ${i + 1}` })
            if (!validator.isNumber(items[i].quantity)) return res.status(400).send({ status: false, message: `Please provide quantity in digits at position ${i + 1}` })

            if (!isProductAvailable.installments > 0) return res.status(400).send({ status: false, message: `Product with ProductId ${items[i].productId} at position ${i + 1} is OUT OF STOCK` })

            if (!items[i].quantity > 0) return res.status(400).send({ status: false, message: `Please provide min 1 quantity at position ${i + 1}` })

            if (!(isProductAvailable.installments >= items[i].quantity)) return res.status(400).send({ status: false, message: `Product with ProductId ${items[i].productId} at position ${i + 1} has Not Such Quantity` })

            totalPrice = totalPrice + (isProductAvailable.price * items[i].quantity)
            totalQuantity = totalQuantity + items[i].quantity

            const updateProductDetails = await productModel.findOneAndUpdate({_id: items[i].productId}, { $inc: { installments: -items[i].quantity } })
        }

        finalData["userId"] = userId
        finalData["items"] = items
        finalData["totalPrice"] = totalPrice
        finalData["totalItems"] = totalItems
        finalData["totalQuantity"] = totalQuantity
        finalData["status"] = "pending"
        finalData["deletedAt"] = ""
        finalData["isDeleted"] = false

        if (cancellable != null) finalData["cancellable"] = cancellable

        const order = await orderModel.create(finalData)
        return res.status(201).send({ status: true, message: "Order details", data: order })
    }
    catch (error) {
        return res.status(500).send({ status: false, message: error.message })
    }
}


const updateOrder = async (req, res) => {
    try {
        userId = req.params.userId;
        const dataForUpdates = req.body
        let finalUpdates = {}

        if (Object.keys(userId) == 0) { return res.status(400).send({ status: false, message: 'Please provide user Id' }) }

        if (Object.keys(dataForUpdates) == 0) { return res.status(400).send({ status: false, message: 'Please provide some data for update' }) }
        const { orderId, status, isDeleted } = dataForUpdates

        if (!validator.isValidID(userId)) { return res.status(400).send({ status: false, message: 'Please provide a valid user Id' }) }
        if (!validator.isValidID(orderId)) { return res.status(400).send({ status: false, message: 'Please provide a valid orderId' }) }

        const userMatch = await userModel.findOne({ _id: userId })
        if (!userMatch) return res.status(404).send({ status: false, message: `No user found with id ${userId}` })

        const orderMatch = await orderModel.findOne({ _id: orderId, isDeleted: false })
        if (!orderMatch) return res.status(404).send({ status: false, message: `No order found with id ${orderId}` })

        const isUsersOrder = await orderModel.findOne({ _id: orderId, userId: userId, isDeleted: false })
        if (!isUsersOrder) return res.status(400).send({ status: false, message: "Login User Is Not The Owner Of The Order" })

        if (status == null) return res.status(400).send({ status: false, message: "Please Provide Order Status to Update The Order" })

        if (status != null) {
            if (!validator.isValid(status)) return res.status(400).send({ status: false, message: "Please Provide Order Status" })
            if (!validator.isValidStatus(status)) return res.status(400).send({ status: false, message: "Please Provide Valid Order Status" })

            if (orderMatch.status == "completed")
                return res.status(400).send({ status: false, message: "Can Not Update This Order, Because It's Completed Already" })

            if (orderMatch.status == "cancelled")
                return res.status(400).send({ status: false, message: "Can Not Update This Order, Because It's Cancelled Already" })

            if (status == "pending" || status == "completed") {
                const updateOrder = await orderModel.findOneAndUpdate({ _id: orderId }, { status: status }, { new: true })
                return res.status(200).send({ status: true, message: "Order Updated", data: updateOrder })
            }

            if (orderMatch.cancellable == true) {
                if (status == "cancelled") {
                    for (let i = 0; i < orderMatch.items.length; i++) {
                        const updateProductDetails = await productModel.findOneAndUpdate({_id: orderMatch.items[i].productId}, { $inc: { installments: orderMatch.items[i].quantity } })
                    }
                    const updateOrder = await orderModel.findOneAndUpdate({ _id: orderId }, { status: status, isDeleted: true, deletedAt: new Date() }, { new: true })
                    return res.status(200).send({ status: true, message: "Order Cancelled", data: updateOrder })
                }
            }
            else return res.status(400).send({ status: true, message: "Can Not Cancel This Order, Because It's Not A Cancellable Order" })
        }
    }
    catch (error) {
        console.log("error",error.message)
        return res.status(500).send({ status: false, message: error.message })
    }
}

module.exports.createOrder = createOrder
module.exports.updateOrder = updateOrder