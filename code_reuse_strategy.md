# Code Reuse Strategy

The practice of identical code being applied to multiple projects or in multiple locations is to be avoided.  The team agrees this creates maintenance problems and has come up with a balanced approach to solving code duplication issues.

## 3 Solutions

Currently there are 3 approaches this project takes to addressing the DRY (Do Not Repeat Yourself) Principle.

1) OOP for code repeated inside same GitHub project,

2) NPM packages & modules for front-end GUI code is being copy/pasted across two or more front-ends, and

3) Mongoose for logic affecting data that has code copy/pasted across two or more front-ends.

In more detail:

### OOP

If code in the same GitHub project is being repeated, use standard OOP (Object Oriented Programming) techniques to write once and reference many.

### Common NPM packages & modules

If front-end GUI code is being copy/pasted across two or more front-ends (currently eagle-admin and eagle-public are two front-ends), then we place the code into the eagle-common-components repository as an NPM packages and modules that the other front-ends then import and consume.

### Mongoose ODM

If business logic for data is being copied across two or more front-ends, we will move that logic down into the business layer components at the Mongoose level.  For example, we wish to provide the front-ends with generated data that is consistently derived from multiple ODM (Object Data Model, provided in this project via Mongoose) fields (representing basic fields in the mongoDB database).  Instead of writing a view in the database, or modifying the data in the API on it's way out to the client (complicating the API), or transforming data with duplicated code in multiple receiving front-ends, we instead can handle this using the built in mechanisms provided by Mongoose for business layer logic.

## Performance, change ticket turnaround, and reusability

The balance between performance, change ticket turnaround, and reusability can be summarized as follows.  We will apply the above code reuse strategy only to new code that is being duplicated.  As new feature & maintenance tickets are dealt with over time, each time we touch code in a new area, any time we come across code duplication that falls into the above three bins, we will address the technical debt at that point.

Any new code we write will follow the above pattern.
