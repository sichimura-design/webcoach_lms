"""定期処理の担当決め(MySQLの名前付きロック)のテスト。DBの代わりにロックの持ち主だけを真似る"""
import pymysql
import pytest

import scheduler_lock


class FakeServer:
    """ロック名→持っている接続ID"""

    def __init__(self):
        self.owner = None
        self.next_id = 1


class FakeConn:
    def __init__(self, server):
        self.server = server
        self.id = server.next_id
        server.next_id += 1
        self.alive = True
        self._result = None

    def cursor(self):
        return self

    def __enter__(self):
        return self

    def __exit__(self, *exc):
        return False

    def execute(self, sql, params=None):
        if not self.alive:
            raise pymysql.err.OperationalError(2013, "Lost connection")
        if sql.startswith("SELECT IS_USED_LOCK"):
            self._result = (1 if self.server.owner == self.id else 0,)
        elif sql.startswith("SELECT GET_LOCK"):
            if self.server.owner is None:
                self.server.owner = self.id
            self._result = (1 if self.server.owner == self.id else 0,)

    def fetchone(self):
        return self._result

    def close(self):
        self.drop()

    def drop(self):
        """接続が切れるとロックも外れる"""
        self.alive = False
        if self.server.owner == self.id:
            self.server.owner = None


@pytest.fixture
def server(monkeypatch):
    server = FakeServer()
    monkeypatch.setattr(scheduler_lock, "_connect", lambda: FakeConn(server))
    monkeypatch.setattr(scheduler_lock, "_conn", None)
    return server


def test_first_caller_becomes_leader_and_stays(server):
    assert scheduler_lock.is_leader() is True
    assert scheduler_lock.is_leader() is True


def test_not_leader_while_another_task_holds_lock(server):
    other = FakeConn(server)
    server.owner = other.id

    assert scheduler_lock.is_leader() is False


def test_takes_over_when_leader_task_stops(server):
    other = FakeConn(server)
    server.owner = other.id
    assert scheduler_lock.is_leader() is False

    other.drop()

    assert scheduler_lock.is_leader() is True


def test_reconnects_when_own_connection_was_lost(server):
    assert scheduler_lock.is_leader() is True
    scheduler_lock._conn.drop()

    assert scheduler_lock.is_leader() is True


def test_not_leader_when_db_unreachable(monkeypatch):
    def fail():
        raise pymysql.err.OperationalError(2003, "Can't connect")

    monkeypatch.setattr(scheduler_lock, "_connect", fail)
    monkeypatch.setattr(scheduler_lock, "_conn", None)

    assert scheduler_lock.is_leader() is False


def test_endpoint(client, monkeypatch):
    monkeypatch.setattr(scheduler_lock, "is_leader", lambda: True)

    res = client.post("/api/scheduler/leader")

    assert res.status_code == 200
    assert res.json() == {"leader": True}
