package com.ifmis.payroll.repository;

import com.ifmis.payroll.entity.master.LKBankMaster;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;
import java.util.UUID;

public interface LKBankMasterRepository extends JpaRepository<LKBankMaster, UUID> {
    Optional<LKBankMaster> findByBankKey(String bankKey);
}
