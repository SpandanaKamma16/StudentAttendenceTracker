function asyncRoute(fn) { return (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next); }
function databaseError(error) {
  if (error?.code === "23505") return { status: 409, message: "A record with that unique value already exists." };
  if (error?.code === "23503") return { status: 400, message: "This record is still linked to other data or a related record does not exist." };
  if (error?.code === "23514" || error?.code === "22P02") return { status: 400, message: "One or more values are invalid." };
  return { status: 500, message: "A database operation failed. Check the server configuration and try again." };
}
function validUUID(value) { return typeof value === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value); }
function validDate(value) { return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(`${value}T00:00:00Z`)) && new Date(`${value}T00:00:00Z`).toISOString().slice(0,10) === value; }
module.exports = { asyncRoute, databaseError, validUUID, validDate };
