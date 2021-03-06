const app = require("../index");
const request = require("supertest");

const agent = request(app);
const authenticatedUser = request.agent(app);

const factoryService = require("./helper/FactoryService");
const databaseConnector = require("../lib/databaseConnector");
const DB_CONNECTOR = new databaseConnector();
const { expect, assert } = require("chai");

describe("Advanced Web Hiring Assessments - Server", () => {
  before(async () => {
    await factoryService.init();
    console.log("\n  🏭factory service started.\n");
  });

  describe("Advanced Web Hiring Assessments - Database", () => {
    after(async () => {
      await DB_CONNECTOR.terminate();
    });

    it("Should connect to database", async () => {
      let response;

      console.log("DB configurations");
      console.table(DB_CONNECTOR["config"]);

      try {
        response = await DB_CONNECTOR.init();
      } catch (e) {
        console.log(e);
      }

      assert.strictEqual(response, "ok");
    });

    it("should have table `users` in database", async () => {
      await DB_CONNECTOR.init();

      try {
        await DB_CONNECTOR.query("DESCRIBE users");
      } catch (error) {
        throw error;
      }
    });
  });

  describe("Advanced Web Hiring Assessments - Server", () => {
    before(async () => {
      await DB_CONNECTOR.init();
    });

    after(async () => {
      await DB_CONNECTOR.terminate();
    });

    beforeEach(async () => {
      await factoryService.setup();
      await factoryService.insertTestUser();
    });

    afterEach(async () => {
      await factoryService.deleteTestUser({
        email: `"hoyong@codestates.com"`,
      });
    });

    describe("POST /signin", () => {
      it("it should respond 200 status code with user id to signin data", async () => {
        const response = await agent.post("/signin").send({
          email: "hoyong@codestates.com",
          password: "password",
        });

        expect(response.status).to.eql(200);
        expect(response.body.id).not.to.eql(undefined);
      });

      it("it should respond 404 status code with invalid user text", async () => {
        const response = await agent.post("/signin").send({
          email: "coding.kim@javascript.com",
          password: "helloWorld",
        });

        expect(response.status).to.eql(404);
        expect(response.text).to.eql("invalid user");
      });
    });

    describe("POST /signup", () => {
      it("it should respond with 201 status code with user info to signup data", async () => {
        const response = await agent.post("/signup").send({
          email: "testuser@gmail.com",
          password: "test",
          username: "testuser",
          mobile: "010-0987-6543",
        });
        expect(response.status).to.eql(201);
        expect(response.body).to.haveOwnPropertyDescriptor("id", "username", "email", "mobile");
      });

      it("it should respond with 409(conflict) status code with existing user email", async () => {
        const response = await agent.post("/signup").send({
          username: "hoyong",
          email: "hoyong@codestates.com",
          password: "password",
          mobile: "010-1234-5678",
        });
        expect(response.status).to.eql(409);
        expect(response.text).to.eql("email exists");
      });

      it("it should respond with 422(unprocessable entity) status code when any one of username, email, password, or mobile parameter is not supplied", async () => {
        const fakeUser = {
          username: "hoyong",
          email: "hoyong@codestates.com",
          password: "password",
          mobile: "010-1234-5678",
        };

        async function multipleSignupRequest(user) {
          const keyList = Object.keys(user);
          const result = [];

          for (let i = 0; i < keyList.length; i++) {
            const oneParameterMissingUser = {};
            keyList
              .filter((key) => key !== keyList[i])
              .forEach((key) => (oneParameterMissingUser[key] = user[key]));
            const response = await agent.post("/signup").send(oneParameterMissingUser);
            result.push(response);
          }
          return result;
        }

        const fakeUserAttempts = await multipleSignupRequest(fakeUser);

        fakeUserAttempts.forEach((attempt) => {
          expect(attempt.status).to.eql(422);
          expect(attempt.text).to.eql("insufficient parameters supplied");
        });
      });
    });

    describe("POST /signout", () => {
      it("it should respond with 205 status code", async () => {
        const response = await agent.post("/signout")
        expect(response.status).to.eql(205);
        expect(response.text).to.eql("Logged out successfully");
      });
    });

    describe("GET /user", () => {
      beforeEach((done) => {
        authenticatedUser
          .post("/signin")
          .send({
            email: "hoyong@codestates.com",
            password: "password",
          })
          .then(() => {
            done();
          });
      });
      it("it should return user data with request of session.userid", (done) => {
        authenticatedUser.get("/user").end(function (err, res2) {
          expect(res2.status).to.eql(200);
          expect(res2.body).to.haveOwnPropertyDescriptor("id", "email", "username", "mobile");
          done();
        });
      });

      it("it should return Unauthorized if request without session.userid", (done) => {
        const authenticateFailedUser = request.agent(app);
        authenticateFailedUser
          .post("/signin")
          .send({
            email: "coding.kim@codestates.com",
            password: "korea",
          })
          .then(function (res) {
            authenticateFailedUser
              .get("/user")
              .then(function (res2) {
                expect(res2.status).to.eql(401);
                done();
              })
              .catch((err) => {
                done(err);
              });
          });
      });
    });
  });
  after(async () => {
    await factoryService.terminate();
    console.log("\n  🏭factory service terminated.\n");
  });
});
