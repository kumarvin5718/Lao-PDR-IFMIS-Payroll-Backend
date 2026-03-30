package com.ifmis.payroll.repository;

import com.ifmis.payroll.entity.master.LKGradeDerivationMaster;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;
import java.util.UUID;

public interface LKGradeDerivationRepository extends JpaRepository<LKGradeDerivationMaster, UUID> {

    Optional<LKGradeDerivationMaster> findByEducationLevelIdAndMinExpYearsLessThanEqualAndMaxExpYearsGreaterThanEqual(
            UUID educationLevelId,
            int exp1,
            int exp2
    );
}