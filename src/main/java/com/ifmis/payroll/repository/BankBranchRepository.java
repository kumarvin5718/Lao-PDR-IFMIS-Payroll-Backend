package com.ifmis.payroll.repository;

import com.ifmis.payroll.entity.master.BankBranch;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;
import java.util.UUID;

public interface BankBranchRepository extends JpaRepository<BankBranch, UUID> {
    Optional<BankBranch> findByBranchCode(String branchCode);
}
