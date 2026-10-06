# Architecture Decision Record (ADR-001)
## Selection of Modular Monolith Architecture over Microservices

* **Status:** Accepted
* **Date:** 2026-10-06
* **Deciders:** Principal Engineering Organization

---

## 1. Context

HomeExpense is a multi-tenant household financial platform requiring strict data consistency, transactional integrity across expense splits and double-entry ledger entries, deterministic mathematical invariance, and sub-100ms response times.

A major architectural fork exists between:
1. **Microservices Architecture:** Splitting Auth, Homes, Expenses, Balances, and Settlements into independent network services with separate databases and distributed sagas / 2-phase commit protocols.
2. **Modular Monolith Architecture:** Organizing the system as a single codebase and deployable runtime with strict internal module boundaries, compile-time interfaces, unidirectional dependencies, and a unified PostgreSQL database supporting ACID transactions.

---

## 2. Decision

We choose a **Modular Monolith** architecture for HomeExpense built on NestJS and PostgreSQL.

---

## 3. Rationale & Non-Negotiable Alignment

1. **Transactional Integrity & Financial Consistency:**
   Financial mutations in HomeExpense require atomic coordination across multiple entities (creating an `Expense`, generating $N$ `ExpenseSplit` records, and generating $N-1$ `LedgerEntry` records). In a microservice ecosystem, this demands distributed transactions (Sagas, Outbox, event buses), which introduce eventual consistency hazards, complex failure compensation, and split-brain financial states. In a modular monolith, this is achieved natively and reliably with a single PostgreSQL interactive database transaction (`prisma.$transaction`).

2. **Latency & Operational Simplicity:**
   Network serialization overhead (JSON over HTTP/gRPC) between microservices degrades user experience. In-process module calls execute with sub-microsecond function invocation performance while maintaining strict compile-time interface barriers.

3. **Development Velocity & Team Cognitive Load:**
   A modular monolith eliminates the operational friction of multi-repository orchestrations, service mesh debugging, distributed tracing complexity, and out-of-order schema migrations.

4. **Future Decomposability:**
   Because module boundaries are strictly enforced (no direct database tampering across boundaries, unidirectional dependencies, and schema separation by domain), any module that legitimately requires independent autoscaling in the future (such as the asynchronous OCR worker) can be decoupled with minimal refactoring.

---

## 4. Consequences & Mitigations

* **Risk (Spaghetti Code):** Monoliths risk code decay if developers bypass module boundaries.
  * *Mitigation:* Enforce strict dependency rules using TypeScript project boundaries, ESLint import restrictions, and architectural linting (`madge`).
* **Risk (Single Database Bottleneck):** All modules querying a single PostgreSQL instance.
  * *Mitigation:* Employ read-replicas, compound tenant-first indexes (`homeId`), and PgBouncer connection pooling.
